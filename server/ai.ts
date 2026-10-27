/**
 * Saylani HCM Lite - Production-Ready AI Assistant Service
 * Integrates Gemini API via @google/genai with function calling / tools,
 * role-scoped data retrieval, Smart Leave NLP parser, Roman Urdu understanding,
 * general-purpose conversational intelligence (ChatGPT-grade), model failover cascade,
 * rate limiting (25/hr/user), 15-second timeout safeguard, sensitive data refusal,
 * and persistent query logging in ai_logs.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { db } from './db.ts';
import { calculateWorkingDays, DEFAULT_SETTINGS } from './rules.ts';
import type { User, AILog } from './types.ts';
import type { AuthenticatedUserPayload } from './auth.ts';

// In-memory rate limiter: userId -> array of invocation timestamps
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const limit = 25; // 25 requests per hour

  let timestamps = rateLimitMap.get(userId) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    rateLimitMap.set(userId, timestamps);
    return false;
  }

  timestamps.push(now);
  rateLimitMap.set(userId, timestamps);
  return true;
}

export function resetRateLimitForTesting() {
  rateLimitMap.clear();
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIChatResponse {
  answer: string;
  toolCalls?: Array<{ name: string; args: any }>;
  smartLeaveAction?: {
    leaveType: 'annual' | 'sick' | 'casual' | 'unpaid';
    startDate: string;
    endDate: string;
    reason: string;
    workingDays: number;
  };
}

export async function processAIChat(
  user: AuthenticatedUserPayload | User,
  userPrompt: string,
  history: ChatHistoryItem[] = []
): Promise<AIChatResponse> {
  const startTime = Date.now();
  const data = db.getData();
  const settings = db.getSettings() || DEFAULT_SETTINGS;

  // 1. Enforce per-user rate limit (25 req/hr)
  if (!checkRateLimit(user.id)) {
    return {
      answer: 'Rate limit exceeded (maximum 25 requests per hour). Please try again later.'
    };
  }

  // 2. Immediate zero-trust refusal: Employees asking for colleague salary or confidential payroll
  const lowerPrompt = userPrompt.toLowerCase();
  const isAskingColleagueSalary =
    user.role === 'employee' &&
    (lowerPrompt.includes('salary') ||
      lowerPrompt.includes('tankhwah') ||
      lowerPrompt.includes('tankhwa') ||
      lowerPrompt.includes('payslip') ||
      lowerPrompt.includes('kamata') ||
      lowerPrompt.includes('kamati') ||
      lowerPrompt.includes('pay') ||
      lowerPrompt.includes('earning')) &&
    (lowerPrompt.includes('colleague') ||
      lowerPrompt.includes('other') ||
      lowerPrompt.includes('doosre') ||
      lowerPrompt.includes('dusre') ||
      lowerPrompt.includes('kisi aur') ||
      lowerPrompt.includes('fellow') ||
      lowerPrompt.includes('all') ||
      lowerPrompt.includes('sab ki') ||
      lowerPrompt.includes('someone') ||
      lowerPrompt.includes('unka') ||
      lowerPrompt.includes('unki'));

  if (isAskingColleagueSalary) {
    const refusalAnswer =
      "Access Denied: You are not authorized to view another employee's salary or confidential financial records.";
    db.addAILog({
      id: `AI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: user.id,
      userRole: user.role,
      prompt: userPrompt,
      toolCalls: null,
      response: refusalAnswer,
      durationMs: Date.now() - startTime,
      createdAt: new Date().toISOString()
    });
    return { answer: refusalAnswer };
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper date calculator for Next Monday & Tuesday using local timezone
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const getNextMondayAndTuesday = () => {
    const today = new Date();
    const day = today.getDay(); // 0 = Sunday, 1 = Monday
    let daysUntilMonday = (1 - day + 7) % 7;
    if (daysUntilMonday === 0) daysUntilMonday = 7;

    const nextMon = new Date(today);
    nextMon.setDate(today.getDate() + daysUntilMonday);

    const nextTue = new Date(nextMon);
    nextTue.setDate(nextMon.getDate() + 1);

    return {
      monday: formatLocal(nextMon),
      tuesday: formatLocal(nextTue)
    };
  };

  // Tool definitions for Gemini Function Calling
  const tools: any[] = [
    {
      name: 'get_headcount',
      description: 'Get total headcount and active employee count. Allowed for Admin and HR.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          department: { type: Type.STRING, description: 'Optional department filter' }
        }
      }
    },
    {
      name: 'get_attendance_summary',
      description: 'Get attendance overview for today or a specific date (present, late, absent, half-day).',
      parameters: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format (defaults to today)' }
        }
      }
    },
    {
      name: 'get_late_comers',
      description: 'Get list of employees who checked in late (after 09:15 AM). Admin/HR only.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format' }
        }
      }
    },
    {
      name: 'get_frequent_late_comers',
      description: 'Get the employee(s) who arrived late the most times this month. Admin/HR only.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          month: { type: Type.INTEGER, description: 'Month number 1-12 (defaults to current month)' },
          year: { type: Type.INTEGER, description: 'Year e.g. 2026' }
        }
      }
    },
    {
      name: 'get_leave_summary',
      description: 'Get leave statistics, pending requests, and currently on-leave employees. Admin/HR only.',
      parameters: {
        type: Type.OBJECT,
        properties: {}
      }
    },
    {
      name: 'get_my_leave_balance',
      description: 'Get current user personal leave balances (used vs quota for annual, sick, casual, unpaid).',
      parameters: {
        type: Type.OBJECT,
        properties: {}
      }
    },
    {
      name: 'get_payroll_summary',
      description: 'Get payroll summary (total gross, tax, net, and employee count) for a month/year. Admin and HR only.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          month: { type: Type.INTEGER, description: 'Month number 1-12' },
          year: { type: Type.INTEGER, description: 'Year e.g. 2026' }
        }
      }
    },
    {
      name: 'search_employees',
      description: 'Search employees by name, code, or department. Employees can only search basic contact info.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: 'Search term for name or department' }
        }
      }
    },
    {
      name: 'parse_smart_leave',
      description: 'Parse a natural language leave application into structured start date, end date, leave type, and reason.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          leaveType: {
            type: Type.STRING,
            enum: ['annual', 'sick', 'casual', 'unpaid'],
            description: 'Type of leave'
          },
          startDate: { type: Type.STRING, description: 'Start date in YYYY-MM-DD' },
          endDate: { type: Type.STRING, description: 'End date in YYYY-MM-DD' },
          reason: { type: Type.STRING, description: 'Reason for leave' }
        },
        required: ['leaveType', 'startDate', 'endDate', 'reason']
      }
    }
  ];

  // Authoritative Tool Executor with RBAC Enforcement
  const executeTool = (toolName: string, args: any): any => {
    switch (toolName) {
      case 'get_headcount': {
        if (user.role === 'employee') {
          return { error: 'Access denied: Headcount analytics is restricted to HR and Admin.' };
        }
        let emps = data.employees.filter((e) => e.status === 'active');
        if (args.department) {
          emps = emps.filter((e) => e.department.toLowerCase() === args.department.toLowerCase());
        }
        return {
          totalActiveHeadcount: emps.length,
          totalRegisteredEmployees: data.employees.length,
          department: args.department || 'All Departments'
        };
      }

      case 'get_attendance_summary': {
        const queryDate = args.date || todayStr;
        if (user.role === 'employee') {
          const myAtt = data.attendance.find(
            (a) => a.employeeId === user.employeeId && a.date === queryDate
          );
          return {
            date: queryDate,
            myStatus: myAtt ? myAtt.status : 'No check-in record for today',
            checkInTime: myAtt?.checkInTime,
            checkOutTime: myAtt?.checkOutTime,
            workHoursMinutes: myAtt?.workHoursMinutes || 0
          };
        }
        const records = data.attendance.filter((a) => a.date === queryDate);
        const present = records.filter((a) => a.status === 'present').length;
        const late = records.filter((a) => a.status === 'late').length;
        const halfDay = records.filter((a) => a.status === 'half_day').length;
        const missing = records.filter((a) => a.missingCheckOut).length;
        return {
          date: queryDate,
          totalRecords: records.length,
          present,
          late,
          halfDay,
          missingCheckout: missing
        };
      }

      case 'get_late_comers': {
        if (user.role === 'employee') {
          return { error: 'Access denied: Restricted to HR and Admin.' };
        }
        const queryDate = args.date || todayStr;
        const lateRecords = data.attendance.filter(
          (a) => a.date === queryDate && (a.status === 'late' || a.isLate)
        );
        const lateList = lateRecords.map((a) => {
          const emp = data.employees.find((e) => e.id === a.employeeId);
          return {
            employeeCode: emp?.employeeCode || 'N/A',
            name: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
            department: emp?.department || 'N/A',
            checkInTime: a.checkInTime,
            lateMinutes: a.lateMinutes || 0
          };
        });
        return {
          date: queryDate,
          lateCount: lateList.length,
          employees: lateList
        };
      }

      case 'get_frequent_late_comers': {
        if (user.role === 'employee') {
          return { error: 'Access denied: Restricted to HR and Admin.' };
        }
        const now = new Date();
        const m = args.month || now.getMonth() + 1;
        const y = args.year || now.getFullYear();
        const prefix = `${y}-${String(m).padStart(2, '0')}`;

        const monthLate = data.attendance.filter(
          (a) => a.date.startsWith(prefix) && (a.status === 'late' || a.isLate)
        );

        const counts: Record<string, number> = {};
        for (const a of monthLate) {
          counts[a.employeeId] = (counts[a.employeeId] || 0) + 1;
        }

        const sorted = Object.entries(counts)
          .map(([empId, lateCount]) => {
            const emp = data.employees.find((e) => e.id === empId);
            return {
              employeeId: empId,
              name: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
              employeeCode: emp?.employeeCode || 'N/A',
              department: emp?.department || 'N/A',
              lateCount
            };
          })
          .sort((a, b) => b.lateCount - a.lateCount);

        return {
          month: m,
          year: y,
          totalLateCheckinsThisMonth: monthLate.length,
          topLateEmployees: sorted
        };
      }

      case 'get_leave_summary': {
        if (user.role === 'employee') {
          return { error: 'Access denied: Restricted to HR and Admin.' };
        }
        const pending = data.leaves.filter((l) => l.status === 'pending').length;
        const approved = data.leaves.filter((l) => l.status === 'approved').length;
        const activeLeavesToday = data.leaves
          .filter((l) => l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr)
          .map((l) => {
            const emp = data.employees.find((e) => e.id === l.employeeId);
            return {
              employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
              leaveType: l.leaveType,
              startDate: l.startDate,
              endDate: l.endDate
            };
          });
        return {
          activeOnLeaveTodayCount: activeLeavesToday.length,
          pendingRequestsCount: pending,
          totalApprovedLeaves: approved,
          employeesOnLeaveToday: activeLeavesToday
        };
      }

      case 'get_my_leave_balance': {
        const empId = user.employeeId;
        if (!empId) {
          return { error: 'No associated employee profile found for user.' };
        }
        const approvedLeaves = data.leaves.filter(
          (l) => l.employeeId === empId && l.status === 'approved'
        );

        const used: Record<string, number> = { annual: 0, sick: 0, casual: 0, unpaid: 0 };
        for (const l of approvedLeaves) {
          used[l.leaveType] = (used[l.leaveType] || 0) + l.workingDays;
        }

        const quotas = settings.leaveQuotas;
        return {
          annual: { quota: quotas.annual, used: used.annual, remaining: Math.max(0, quotas.annual - used.annual) },
          sick: { quota: quotas.sick, used: used.sick, remaining: Math.max(0, quotas.sick - used.sick) },
          casual: { quota: quotas.casual, used: used.casual, remaining: Math.max(0, quotas.casual - used.casual) },
          unpaid: { used: used.unpaid, remaining: 'Unlimited' }
        };
      }

      case 'get_payroll_summary': {
        if (user.role === 'employee') {
          return { error: 'Access denied: Payroll summaries are restricted to HR and Admin.' };
        }
        const now = new Date();
        const m = args.month || now.getMonth() + 1;
        const y = args.year || now.getFullYear();
        const monthKey = `${y}-${String(m).padStart(2, '0')}`;
        const run = data.payrolls.find((p) => p.month === monthKey);
        if (!run) {
          return { message: `No payroll generated yet for ${monthKey}.` };
        }
        return {
          month: run.month,
          status: run.status,
          totalGross: run.totalGross,
          totalTax: run.totalTax,
          totalNet: run.totalNet,
          employeeCount: run.items.length
        };
      }

      case 'search_employees': {
        const q = (args.query || '').toLowerCase();
        let matches = data.employees.filter(
          (e) =>
            e.firstName.toLowerCase().includes(q) ||
            e.lastName.toLowerCase().includes(q) ||
            e.employeeCode.toLowerCase().includes(q) ||
            e.department.toLowerCase().includes(q)
        );

        if (user.role === 'employee') {
          return matches.map((e) => ({
            employeeCode: e.employeeCode,
            name: `${e.firstName} ${e.lastName}`,
            department: e.department,
            designation: e.designation,
            email: e.email
          }));
        }

        return matches.map((e) => ({
          id: e.id,
          employeeCode: e.employeeCode,
          name: `${e.firstName} ${e.lastName}`,
          department: e.department,
          designation: e.designation,
          email: e.email,
          status: e.status,
          grossSalary: e.grossSalary
        }));
      }

      case 'parse_smart_leave': {
        const weekends = settings.weekends || [0, 6];
        const workingDays = calculateWorkingDays(args.startDate, args.endDate, [], weekends);
        return {
          leaveType: args.leaveType,
          startDate: args.startDate,
          endDate: args.endDate,
          reason: args.reason,
          workingDays
        };
      }

      default:
        return { error: `Tool ${toolName} not found` };
    }
  };

  // Authoritative Fallback / Offline Evaluation (Handles Roman Urdu & English without external API calls)
  const runFallback = (): AIChatResponse => {
    // 0. Friendly greetings & identity handling
    if (
      lowerPrompt === 'hi' ||
      lowerPrompt === 'hello' ||
      lowerPrompt === 'hey' ||
      lowerPrompt === 'salam' ||
      lowerPrompt === 'aoa' ||
      lowerPrompt === 'asalam alaikum' ||
      lowerPrompt === 'assalam o alaikum' ||
      lowerPrompt === 'good morning' ||
      lowerPrompt === 'good afternoon' ||
      lowerPrompt.startsWith('hi ') ||
      lowerPrompt.startsWith('hello ')
    ) {
      return {
        answer: `Hello! I am your AI Assistant for Saylani HCM Lite. How can I help you today? You can ask me anything from general topics, writing, or coding, to HCM attendance, leave balances, or company policies.`
      };
    }

    if (
      lowerPrompt.includes('tum kon ho') ||
      lowerPrompt.includes('who are you') ||
      lowerPrompt.includes('aap kon ho') ||
      lowerPrompt.includes('kya kar sakte ho') ||
      lowerPrompt.includes('what can you do')
    ) {
      return {
        answer: `I am your AI Assistant for Saylani HCM Lite. I have general-purpose conversational capabilities (like explaining concepts, drafting emails, helping with programming) and specialized tools to check attendance, monitor leave balances, draft smart leave requests, and provide authorized HR analytics.`
      };
    }

    if (lowerPrompt.includes('thank') || lowerPrompt.includes('shukriya') || lowerPrompt.includes('thanks')) {
      return {
        answer: `You're very welcome! Let me know if there's anything else I can assist you with.`
      };
    }

    if (lowerPrompt.includes('what do you think of my company') || lowerPrompt.includes('company kaisi hai')) {
      return {
        answer: `Saylani Welfare International Trust is doing outstanding work serving humanity across healthcare, education, feeding programs, and IT training. Using an automated, transparent Human Capital Management system like HCM Lite ensures staff dedication and operational excellence!`
      };
    }

    // 1. "Aaj kitne employees leave par hain?"
    if (
      (lowerPrompt.includes('leave') || lowerPrompt.includes('chutti')) &&
      (lowerPrompt.includes('aaj') || lowerPrompt.includes('today')) &&
      (lowerPrompt.includes('kitne') || lowerPrompt.includes('kaun') || lowerPrompt.includes('who') || lowerPrompt.includes('how many'))
    ) {
      if (user.role === 'employee') {
        return {
          answer: 'Company-wide leave analytics is restricted to HR and Admin roles.'
        };
      }
      const leaveSummary: any = executeTool('get_leave_summary', {});
      const count = leaveSummary.activeOnLeaveTodayCount || 0;
      if (count === 0) {
        return {
          answer: 'Aaj koi employee leave par nahi hai (0 employees currently on leave today).'
        };
      }
      const names = leaveSummary.employeesOnLeaveToday
        .map((e: any) => `${e.employeeName} (${e.leaveType})`)
        .join(', ');
      return {
        answer: `Aaj kul ${count} employee(s) leave par hain:\n${names}`
      };
    }

    // 2. "Is month sab se zyada late kaun aaya?"
    if (
      lowerPrompt.includes('late') &&
      (lowerPrompt.includes('sab se zyada') ||
        lowerPrompt.includes('most') ||
        lowerPrompt.includes('highest') ||
        lowerPrompt.includes('frequent'))
    ) {
      if (user.role === 'employee') {
        return {
          answer: 'Company-wide attendance analytics is restricted to HR and Admin roles.'
        };
      }
      const res: any = executeTool('get_frequent_late_comers', {});
      if (!res.topLateEmployees || res.topLateEmployees.length === 0) {
        return {
          answer: 'Is mahine koi bhi employee late nahi aaya (No late arrivals recorded this month yet).'
        };
      }
      const top = res.topLateEmployees[0];
      return {
        answer: `Is month sab se zyada late aane wale employee **${top.name}** (${top.employeeCode}, ${top.department}) hain, jo kul **${top.lateCount}** martaba late aaye.`
      };
    }

    // 3. "Meri kitni sick leaves baqi hain?" / personal leave balances
    if (
      (lowerPrompt.includes('leave') || lowerPrompt.includes('chutti')) &&
      (lowerPrompt.includes('balance') ||
        lowerPrompt.includes('baqi') ||
        lowerPrompt.includes('remaining') ||
        lowerPrompt.includes('kitni') ||
        lowerPrompt.includes('kitna'))
    ) {
      const res: any = executeTool('get_my_leave_balance', {});
      if (res.error) {
        return { answer: res.error };
      }

      if (lowerPrompt.includes('sick')) {
        return {
          answer: `Aap ki **${res.sick.remaining}** sick leaves baqi hain (Annual Quota: ${res.sick.quota}, Used: ${res.sick.used}).`
        };
      }
      if (lowerPrompt.includes('casual')) {
        return {
          answer: `Aap ki **${res.casual.remaining}** casual leaves baqi hain (Annual Quota: ${res.casual.quota}, Used: ${res.casual.used}).`
        };
      }
      if (lowerPrompt.includes('annual')) {
        return {
          answer: `Aap ki **${res.annual.remaining}** annual leaves baqi hain (Annual Quota: ${res.annual.quota}, Used: ${res.annual.used}).`
        };
      }

      return {
        answer: `Aap ka current leave balance yeh hai:\n- Annual Leaves: ${res.annual.remaining} baqi (Quota: ${res.annual.quota})\n- Sick Leaves: ${res.sick.remaining} baqi (Quota: ${res.sick.quota})\n- Casual Leaves: ${res.casual.remaining} baqi (Quota: ${res.casual.quota})\n- Unpaid Leaves: Unlimited`
      };
    }

    // 4. "Mujhe next Monday aur Tuesday ki casual leave chahiye." / Smart Leave Intent
    if (
      (lowerPrompt.includes('leave') || lowerPrompt.includes('chutti') || lowerPrompt.includes('off')) &&
      (lowerPrompt.includes('chahiye') ||
        lowerPrompt.includes('apply') ||
        lowerPrompt.includes('want') ||
        lowerPrompt.includes('need') ||
        lowerPrompt.includes('monday') ||
        lowerPrompt.includes('tuesday') ||
        lowerPrompt.includes('tomorrow') ||
        lowerPrompt.includes('kal'))
    ) {
      let startDateStr = '';
      let endDateStr = '';
      const reasonText = userPrompt;
      let lType: 'annual' | 'sick' | 'casual' | 'unpaid' = 'casual';

      if (lowerPrompt.includes('sick') || lowerPrompt.includes('bukhar') || lowerPrompt.includes('tabiyat')) {
        lType = 'sick';
      } else if (lowerPrompt.includes('annual')) {
        lType = 'annual';
      } else if (lowerPrompt.includes('unpaid')) {
        lType = 'unpaid';
      }

      if (lowerPrompt.includes('monday') && lowerPrompt.includes('tuesday')) {
        const dates = getNextMondayAndTuesday();
        startDateStr = dates.monday;
        endDateStr = dates.tuesday;
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        startDateStr = formatLocal(tomorrow);
        endDateStr = startDateStr;
      }

      const weekends = settings.weekends || [0, 6];
      const workingDays = calculateWorkingDays(startDateStr, endDateStr, [], weekends);

      return {
        answer: `I have prepared your smart leave application for **${startDateStr}** to **${endDateStr}** (${workingDays} working days, ${lType.toUpperCase()} leave). Please review the details below and confirm to submit to HR.`,
        smartLeaveAction: {
          leaveType: lType,
          startDate: startDateStr,
          endDate: endDateStr,
          reason: reasonText,
          workingDays
        }
      };
    }

    // 5. Attendance & Present count (Includes "Aj kitne log present hain?" and "Aaj kitnay employees office aaye?")
    if (
      lowerPrompt.includes('attendance') ||
      lowerPrompt.includes('hajri') ||
      lowerPrompt.includes('present') ||
      lowerPrompt.includes('aaye') ||
      lowerPrompt.includes('aye') ||
      lowerPrompt.includes('late')
    ) {
      if (user.role === 'employee') {
        const att: any = executeTool('get_attendance_summary', {});
        return {
          answer: `Today's attendance status: ${att.myStatus}. Check-in: ${
            att.checkInTime ? new Date(att.checkInTime).toLocaleTimeString() : 'Not yet checked in'
          }.`
        };
      } else {
        const summary: any = executeTool('get_attendance_summary', {});
        return {
          answer: `Today's Attendance Overview (${summary.date}):\n- Present: ${summary.present}\n- Late Arrivals: ${summary.late}\n- Half Days: ${summary.halfDay}\n- Missing Checkouts: ${summary.missingCheckout}\n- Total Records: ${summary.totalRecords}`
        };
      }
    }

    // 6. Policy rules queries
    if (
      lowerPrompt.includes('policy') ||
      lowerPrompt.includes('timing') ||
      lowerPrompt.includes('rules') ||
      lowerPrompt.includes('threshold') ||
      lowerPrompt.includes('tax')
    ) {
      return {
        answer: `Official Saylani HCM Lite Policies:\n- Working hours: ${settings.workStartTime} to ${settings.workEndTime}\n- Grace period: ${settings.lateGraceMinutes} minutes (Arrivals after 09:15 AM are marked Late)\n- Half-day threshold: Recorded working time under ${settings.halfDayMinHours} hours\n- Annual Leave Quotas: Annual (${settings.leaveQuotas.annual}), Sick (${settings.leaveQuotas.sick}), Casual (${settings.leaveQuotas.casual}), Unpaid (Unlimited)\n- Pakistan Tax Slabs (Annual): Up to 600k (0%), 600k-1.2M (5%), 1.2M-2.4M (15% + 30k), 2.4M-3.6M (25% + 210k), >3.6M (35% + 510k).`
      };
    }

    // 7. Headcount query
    if (lowerPrompt.includes('headcount') || lowerPrompt.includes('employees') || lowerPrompt.includes('staff')) {
      if (user.role === 'employee') {
        return { answer: 'Total headcount and staffing metrics are restricted to HR and Admin.' };
      }
      const count: any = executeTool('get_headcount', {});
      if (count.totalActiveHeadcount === 0) {
        return { answer: 'There are currently 0 active employees registered in the system (clean state).' };
      }
      return { answer: `Current active employee headcount across the company is ${count.totalActiveHeadcount}.` };
    }

    // 8. General conversational fallback when remote LLM is temporarily unreachable
    return {
      answer: `I understand your question: "${userPrompt}". I am currently running in local offline resilience mode. For complex general reasoning or open coding assistance, please ensure internet connectivity and a valid Gemini model quota. In the meantime, I am fully equipped to handle all Saylani HCM attendance, leave applications, policy rules, and authorized HR analytics!`
    };
  };

  let answer = '';
  let toolCallsLog: any[] = [];
  let smartLeaveAction: any = undefined;

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const fallbackRes = runFallback();
    answer = fallbackRes.answer;
    smartLeaveAction = fallbackRes.smartLeaveAction;
  } else {
    // Model fallback cascade for maximum uptime and resilience against 429/503 spikes
    const candidateModels = [
      process.env.GEMINI_MODEL,
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-flash-latest',
      'gemini-pro-latest'
    ].filter((m): m is string => Boolean(m));

    // Deduplicate models while preserving order
    const uniqueModels = Array.from(new Set(candidateModels));

    const systemInstruction = `
You are the official AI Assistant for Saylani HCM Lite (Human Capital Management System for Saylani Welfare International Trust).
Current local date: ${todayStr}.
Current User: ${user.fullName} (Role: ${user.role}, Email: ${user.email}).

YOUR NATURE AND CAPABILITIES:
1. GENERAL INTELLIGENCE (ChatGPT-style): You can intelligently answer and converse on ANY appropriate topic, whether related or unrelated to HCM! You can explain programming languages (Python, JavaScript, TypeScript, SQL), debug code, teach mathematics, science, draft professional emails and letters, translate between languages, brainstorm ideas, and converse naturally.
2. NATURAL GREETINGS: When the user says "hi", "salam", "tum kon ho?", etc., respond naturally, warmly, and concisely! Do NOT repeat a long static system introduction on every single message.
3. MULTILINGUAL: You are fully fluent in English, Urdu, and Roman Urdu (e.g. "Aj kitne log present hain?", "Mera leave balance kitna hai?", "Mujhe kal chutti chahiye", "Python kya hoti hai?"). Respond in the language used by the user.
4. ACCURACY & HONESTY: Never fabricate facts or metrics. When discussing Saylani HCM operations (attendance, headcount, leaves, payroll), ALWAYS invoke the provided tools to query real database records.

OFFICIAL POLICIES & RULES:
- Working Hours: ${settings.workStartTime} to ${settings.workEndTime} PKT.
- Lateness: ${settings.lateGraceMinutes}-minute grace period (arrivals after 09:15 AM PKT are marked "late").
- Half Day: Any recorded work time under ${settings.halfDayMinHours} hours is "half_day".
- Leave Quotas (Annual): Annual: ${settings.leaveQuotas.annual}, Sick: ${settings.leaveQuotas.sick}, Casual: ${settings.leaveQuotas.casual}, Unpaid: Unlimited. Leaves exclude weekends.
- Payroll Formulas: Basic, HRA = 40% of basic, Medical = 10% of basic, Gross = 1.5 * Basic. Monthly tax = Annual Tax / 12.

SECURITY & ROLE-BASED ACCESS CONTROL (RBAC):
- Admin: Full company-wide access (headcount, attendance, payroll, audit logs).
- HR: Company-wide headcount, attendance, employee directory, leave requests, payroll drafts.
- Employee: ONLY their own attendance, leave balances, payslips, and general company policies.
- ZERO-TRUST PRIVACY REFUSAL: If an employee inquires about a colleague's salary or confidential financial records, POLITELY AND FIRMLY REFUSE.
`;

    const ai = new GoogleGenAI();
    let modelSuccess = false;

    // Build multi-turn conversational contents
    const contents: any[] = [];
    const recentHistory = (history || []).slice(-8); // Include up to 8 prior turns for context
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: userPrompt }]
    });

    for (const modelName of uniqueModels) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`AI request timed out on model ${modelName} (12s limit)`)), 12000)
        );

        const modelCall = ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: tools }],
            temperature: 0.3
          }
        });

        const response = await Promise.race([modelCall, timeoutPromise]);
        const functionCalls = response.functionCalls;

        if (functionCalls && functionCalls.length > 0) {
          const functionResponses: any[] = [];
          for (const call of functionCalls) {
            const fnName = call.name || '';
            toolCallsLog.push({ name: fnName, args: call.args });
            const result = executeTool(fnName, call.args);

            if (fnName === 'parse_smart_leave') {
              smartLeaveAction = result;
            }

            functionResponses.push({
              name: fnName,
              response: { result }
            });
          }

          // Second turn with tool results, preserving original model candidate parts (including thoughtSignature)
          const modelTurn = (response as any).candidates?.[0]?.content || {
            role: 'model',
            parts: functionCalls.map((fc) => ({ functionCall: fc }))
          };

          const secondTurnContents = [
            ...contents,
            modelTurn,
            {
              role: 'user',
              parts: functionResponses.map((fr) => ({
                functionResponse: {
                  name: fr.name,
                  response: fr.response
                }
              }))
            }
          ];

          const secondCall = ai.models.generateContent({
            model: modelName,
            contents: secondTurnContents,
            config: {
              systemInstruction,
              temperature: 0.3
            }
          });

          const secondResponse = await Promise.race([secondCall, timeoutPromise]);
          let textParts = '';
          if ((secondResponse as any).candidates?.[0]?.content?.parts) {
            textParts = (secondResponse as any).candidates[0].content.parts
              .filter((p: any) => p.text)
              .map((p: any) => p.text)
              .join('\n');
          }
          let generatedText = textParts.trim() || secondResponse.text?.trim();

          if (!generatedText && functionResponses.length > 0) {
            const firstResult = functionResponses[0]?.response?.result;
            if (firstResult && typeof firstResult === 'object') {
              if ('present' in firstResult) {
                generatedText = `Today's Attendance Overview (${firstResult.date || todayStr}): Present: ${firstResult.present}, Late Arrivals: ${firstResult.late || 0}, Half Days: ${firstResult.halfDay || 0}, Missing Checkouts: ${firstResult.missingCheckout || 0}.`;
              } else if ('totalActiveHeadcount' in firstResult) {
                generatedText = `Current active employee headcount across the company is ${firstResult.totalActiveHeadcount}.`;
              }
            }
          }

          answer = generatedText || 'Information retrieved based on authoritative records.';
        } else {
          let textParts = '';
          if ((response as any).candidates?.[0]?.content?.parts) {
            textParts = (response as any).candidates[0].content.parts
              .filter((p: any) => p.text)
              .map((p: any) => p.text)
              .join('\n');
          }
          answer = textParts.trim() || response.text || 'I could not process the question with the available rules.';
        }

        modelSuccess = true;
        break; // Successfully answered with this model
      } catch (err: any) {
        console.warn(`[AI] Notice: Model '${modelName}' unavailable (${err?.message || err}), trying fallback...`);
      }
    }

    if (!modelSuccess) {
      console.warn('[AI] All candidate models exhausted or rate-limited. Activating authoritative local rules engine.');
      const fallbackRes = runFallback();
      answer = fallbackRes.answer;
      smartLeaveAction = fallbackRes.smartLeaveAction;
    }
  }

  const durationMs = Date.now() - startTime;

  // Append query to ai_logs for security auditability
  const aiLogEntry: AILog = {
    id: `AI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId: user.id,
    userRole: user.role,
    prompt: userPrompt,
    toolCalls: toolCallsLog.length > 0 ? toolCallsLog : null,
    response: answer,
    durationMs,
    createdAt: new Date().toISOString()
  };
  db.addAILog(aiLogEntry);

  return {
    answer,
    toolCalls: toolCallsLog.length > 0 ? toolCallsLog : undefined,
    smartLeaveAction
  };
}
