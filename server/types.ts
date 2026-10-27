/**
 * Saylani HCM Lite - Core TypeScript Types & Models
 * Defines all domain entities: Users, Employees, Biometrics, Attendance,
 * Fallback Requests, Leaves, Payroll, Company Settings, and Audit Logs.
 */

export type UserRole = 'admin' | 'hr' | 'employee';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  employeeId?: string; // Links to Employee record for employee role
  fullName: string;
  mustChangePassword: boolean;
  activationToken?: string; // One-time activation token
  activationTokenExpires?: string; // ISO string
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  employeeCode: string; // e.g. EMP-0001
  userId?: string; // Linked user account
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  designation: string;
  dateOfJoining: string; // YYYY-MM-DD
  basicSalary: number;
  hra: number; // 40% of basic
  medicalAllowance: number; // 10% of basic
  grossSalary: number; // 1.5 * basic
  status: 'active' | 'inactive';
  deactivationDate?: string; // Effective deactivation date (YYYY-MM-DD)
  deactivationReason?: string; // Reason for deactivation
  finalWorkingDate?: string; // Documented final working date (YYYY-MM-DD)
  terminationReason?: string; // Detailed termination reason / category
  rehireEligible?: boolean; // Whether employee is eligible for rehire
  reactivationDate?: string; // Date of reactivation (YYYY-MM-DD or ISO)
  reactivationReason?: string; // Reason for reactivation
  faceEnrolled: boolean;
  biometricConsent: boolean;
  biometricConsentDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus = 'present' | 'late' | 'half_day' | 'absent';
export type VerificationMethod = 'face_verified' | 'manual_fallback' | 'hr_approved';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD in company timezone
  checkInTime?: string; // ISO UTC string
  checkOutTime?: string; // ISO UTC string
  status: AttendanceStatus;
  checkInMethod?: VerificationMethod;
  checkOutMethod?: VerificationMethod;
  workHoursMinutes?: number;
  isLate: boolean;
  lateMinutes?: number;
  isHalfDay: boolean;
  missingCheckOut: boolean;
  notes?: string;
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FallbackAttendanceRequest {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  actionType: 'check_in' | 'check_out';
  requestedTimestamp: string; // ISO UTC
  reason: 'camera_denied' | 'hardware_failure' | 'verification_failure' | 'consent_withdrawn' | 'accessibility_need' | 'other';
  reasonDetails: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface EncryptedBiometricTemplate {
  employeeId: string;
  algorithm: 'aes-256-gcm';
  iv: string; // Hex
  authTag: string; // Hex
  encryptedData: string; // Hex
  qualityScore: number;
  samplesCount: number;
  enrolledAt: string;
  updatedAt: string;
}

export interface LeaveRecord {
  id: string;
  employeeId: string;
  leaveType: 'annual' | 'sick' | 'casual' | 'unpaid';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  workingDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  comments?: string;
  createdAt: string;
}

export interface PayrollRecord {
  id: string;
  month: string; // YYYY-MM
  status: 'draft' | 'finalized';
  finalizedAt?: string;
  finalizedBy?: string;
  items: PayrollItem[];
  totalGross: number;
  totalTax: number;
  totalDeductions: number;
  totalNet: number;
  createdAt: string;
}

export interface PayrollItem {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  basicSalary: number;
  grossSalary: number;
  workingDaysInMonth: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  unpaidLeaves: number;
  absentDeduction: number;
  halfDayDeduction: number;
  unpaidLeaveDeduction: number;
  totalDeductions: number;
  taxableSalary: number;
  monthlyTax: number;
  netSalary: number;
}

export interface CompanySettings {
  companyName: string;
  timezone: string; // default "Asia/Karachi"
  workStartTime: string; // e.g. "09:00"
  workEndTime: string; // e.g. "18:00"
  lateGraceMinutes: number; // e.g. 15 (after 09:15 is late)
  halfDayMinHours: number; // e.g. 5.0 hours
  leaveQuotas: {
    annual: number; // 14
    sick: number; // 8
    casual: number; // 10
  };
  weekends: number[]; // [0, 6] (Sun=0, Sat=6)
  biometricPolicy: {
    requireBiometricAttendance: boolean;
    allowFallbackAttendance: boolean;
    matchingThreshold: number; // Euclidean distance <= 0.45
    retentionDays: number; // 365
  };
}

export interface AuditLog {
  id: string;
  timestamp: string; // ISO UTC
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string; // Sanitized details (NO passwords or raw biometrics)
  ipAddress?: string;
}

export interface AILog {
  id: string;
  userId: string;
  userRole: string;
  prompt: string;
  toolCalls?: any;
  response: string;
  durationMs: number;
  createdAt: string;
}

export interface DatabaseSchema {
  isSetup: boolean;
  settings: CompanySettings;
  users: User[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  fallbackRequests: FallbackAttendanceRequest[];
  leaves: LeaveRecord[];
  payrolls: PayrollRecord[];
  auditLogs: AuditLog[];
  aiLogs?: AILog[];
}
