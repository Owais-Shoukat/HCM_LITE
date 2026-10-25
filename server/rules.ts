/**
 * Saylani HCM Lite - Business Rules Engine
 * Implements attendance policy, lateness rules, working hours,
 * salary computation, and progressive tax slab calculations.
 */

import type { CompanySettings, AttendanceStatus } from './types.ts';

export const DEFAULT_SETTINGS: CompanySettings = {
  companyName: 'Saylani Welfare International Trust',
  timezone: 'Asia/Karachi',
  workStartTime: '09:00',
  workEndTime: '18:00',
  lateGraceMinutes: 15, // Up to 09:15 is on-time; 09:16+ is late
  halfDayMinHours: 5.0, // Minimum 5 hours needed for full day
  leaveQuotas: {
    annual: 14,
    sick: 8,
    casual: 10
  },
  weekends: [0, 6], // Sunday = 0, Saturday = 6
  biometricPolicy: {
    requireBiometricAttendance: true,
    allowFallbackAttendance: true,
    matchingThreshold: 0.45,
    retentionDays: 365
  }
};

/**
 * Parses an ISO UTC string or Date object and returns localized components for the target timezone
 */
export function getLocalizedDateTime(date: Date | string, timezone: string = 'Asia/Karachi') {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Format into YYYY-MM-DD
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const dateStr = dateFormatter.format(d); // e.g. "2026-10-25"

  // Format into HH:mm
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const timeStr = timeFormatter.format(d); // e.g. "09:12"

  const [hours, minutes] = timeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;

  return { dateStr, timeStr, hours, minutes, totalMinutes };
}

/**
 * Evaluates check-in lateness based on authoritative company settings
 */
export function evaluateCheckIn(checkInIsoUtc: string, settings: CompanySettings = DEFAULT_SETTINGS) {
  const { dateStr, timeStr, totalMinutes } = getLocalizedDateTime(checkInIsoUtc, settings.timezone);
  
  const [startH, startM] = settings.workStartTime.split(':').map(Number);
  const scheduledStartMinutes = startH * 60 + startM;
  const graceCutoffMinutes = scheduledStartMinutes + settings.lateGraceMinutes;

  const isLate = totalMinutes > graceCutoffMinutes;
  const lateMinutes = isLate ? totalMinutes - scheduledStartMinutes : 0;
  const status: AttendanceStatus = isLate ? 'late' : 'present';

  return {
    date: dateStr,
    time: timeStr,
    isLate,
    lateMinutes,
    status
  };
}

/**
 * Evaluates check-out work duration and determines if day qualifies as full day or half day
 */
export function evaluateCheckOut(
  checkInIsoUtc: string,
  checkOutIsoUtc: string,
  currentStatus: AttendanceStatus,
  settings: CompanySettings = DEFAULT_SETTINGS
) {
  const checkInMs = new Date(checkInIsoUtc).getTime();
  const checkOutMs = new Date(checkOutIsoUtc).getTime();
  
  const diffMs = Math.max(0, checkOutMs - checkInMs);
  const workHours = diffMs / (1000 * 60 * 60);
  const workHoursMinutes = Math.round(diffMs / (1000 * 60));

  const isHalfDay = workHours < settings.halfDayMinHours;
  let finalStatus: AttendanceStatus = currentStatus;

  if (isHalfDay) {
    finalStatus = 'half_day';
  }

  return {
    workHours: Number(workHours.toFixed(2)),
    workHoursMinutes,
    isHalfDay,
    status: finalStatus
  };
}

/**
 * Calculates official Saylani salary components:
 * - HRA: 40% of Basic
 * - Medical: 10% of Basic
 * - Gross: 1.5 * Basic
 */
export function calculateSalaryStructure(basicSalary: number) {
  const basic = Math.max(0, basicSalary);
  const hra = Math.round(basic * 0.4);
  const medicalAllowance = Math.round(basic * 0.1);
  const grossSalary = basic + hra + medicalAllowance; // Exactly 1.5 * basic

  return {
    basicSalary: basic,
    hra,
    medicalAllowance,
    grossSalary
  };
}

/**
 * Progressive Tax Calculation (Pakistan Income Tax Slabs / 12)
 * Annual slabs:
 * 1. 0 - 600,000: 0%
 * 2. 600,001 - 1,200,000: 5% of excess
 * 3. 1,200,001 - 2,400,000: 30,000 + 15% of excess
 * 4. 2,400,001 - 3,600,000: 210,000 + 25% of excess
 * 5. > 3,600,000: 510,000 + 35% of excess
 */
export function calculateAnnualTax(annualTaxableIncome: number): number {
  const income = Math.max(0, annualTaxableIncome);
  if (income <= 600000) return 0;
  if (income <= 1200000) {
    return (income - 600000) * 0.05;
  }
  if (income <= 2400000) {
    return 30000 + (income - 1200000) * 0.15;
  }
  if (income <= 3600000) {
    return 210000 + (income - 2400000) * 0.25;
  }
  return 510000 + (income - 3600000) * 0.35;
}

export function calculateMonthlyTax(monthlyGrossSalary: number): number {
  const annualIncome = monthlyGrossSalary * 12;
  const annualTax = calculateAnnualTax(annualIncome);
  return Math.round(annualTax / 12);
}
