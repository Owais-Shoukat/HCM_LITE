export type UserRole = 'admin' | 'hr' | 'employee';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  fullName: string;
  mustChangePassword: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  designation: string;
  dateOfJoining: string;
  basicSalary?: number;
  hra?: number;
  medicalAllowance?: number;
  grossSalary?: number;
  status: 'active' | 'inactive';
  deactivationDate?: string;
  deactivationReason?: string;
  finalWorkingDate?: string;
  terminationReason?: string;
  rehireEligible?: boolean;
  reactivationDate?: string;
  reactivationReason?: string;
  faceEnrolled: boolean;
  biometricConsent: boolean;
  biometricConsentDate?: string;
  createdAt: string;
  userAccount?: {
    id: string;
    email: string;
    isActive: boolean;
    mustChangePassword: boolean;
    hasActivationToken: boolean;
    activationTokenExpires?: string;
  } | null;
}

export type AttendanceStatus = 'present' | 'late' | 'half_day' | 'absent';
export type VerificationMethod = 'face_verified' | 'manual_fallback' | 'hr_approved';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: AttendanceStatus;
  checkInMethod?: VerificationMethod;
  checkOutMethod?: VerificationMethod;
  workHoursMinutes?: number;
  isLate: boolean;
  lateMinutes?: number;
  isHalfDay: boolean;
  missingCheckOut: boolean;
  notes?: string;
  createdAt: string;
}

export interface FallbackAttendanceRequest {
  id: string;
  employeeId: string;
  date: string;
  actionType: 'check_in' | 'check_out';
  requestedTimestamp: string;
  reason: 'camera_denied' | 'hardware_failure' | 'verification_failure' | 'consent_withdrawn' | 'accessibility_need' | 'other';
  reasonDetails: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  createdAt: string;
  employee?: {
    id: string;
    employeeCode: string;
    fullName: string;
    department: string;
  } | null;
}

export interface CompanySettings {
  companyName: string;
  timezone: string;
  workStartTime: string;
  workEndTime: string;
  lateGraceMinutes: number;
  halfDayMinHours: number;
  leaveQuotas: {
    annual: number;
    sick: number;
    casual: number;
  };
  biometricPolicy: {
    requireBiometricAttendance: boolean;
    allowFallbackAttendance: boolean;
    matchingThreshold: number;
    retentionDays: number;
  };
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
}
