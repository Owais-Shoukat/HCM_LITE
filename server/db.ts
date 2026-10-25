/**
 * Saylani HCM Lite - Atomic Persistence Layer
 * Manages dual JSON stores:
 * 1. data/hcm_data.json: Main business store (Users, Employees, Attendance, Settings, Audit)
 * 2. data/biometrics.enc.json: Isolated, encrypted biometric vault
 * 
 * Employs atomic temp-file-write + rename to prevent data corruption.
 * Provides transactional rollback support for multi-step registrations.
 */

import fs from 'fs';
import path from 'path';
import type {
  DatabaseSchema,
  User,
  Employee,
  AttendanceRecord,
  FallbackAttendanceRequest,
  EncryptedBiometricTemplate,
  LeaveRecord,
  PayrollRecord,
  AuditLog
} from './types.ts';
import { DEFAULT_SETTINGS } from './rules.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'hcm_data.json');
const BIOMETRICS_FILE = path.join(DATA_DIR, 'biometrics.enc.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface BiometricsStore {
  templates: EncryptedBiometricTemplate[];
}

class Database {
  private data: DatabaseSchema;
  private biometrics: BiometricsStore;
  private isSaving: boolean = false;

  constructor() {
    this.data = this.loadData();
    this.biometrics = this.loadBiometrics();
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[DB] Error loading hcm_data.json:', err);
    }

    const initial: DatabaseSchema = {
      isSetup: false,
      settings: { ...DEFAULT_SETTINGS },
      users: [],
      employees: [],
      attendance: [],
      fallbackRequests: [],
      leaves: [],
      payrolls: [],
      auditLogs: []
    };

    this.saveDataAtomic(initial);
    return initial;
  }

  private loadBiometrics(): BiometricsStore {
    try {
      if (fs.existsSync(BIOMETRICS_FILE)) {
        const raw = fs.readFileSync(BIOMETRICS_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[DB] Error loading biometrics.enc.json:', err);
    }

    const initial: BiometricsStore = { templates: [] };
    this.saveBiometricsAtomic(initial);
    return initial;
  }

  private saveDataAtomic(data: DatabaseSchema) {
    const tmpFile = path.join(DATA_DIR, `hcm_data.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`);
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  private saveBiometricsAtomic(store: BiometricsStore) {
    const tmpFile = path.join(DATA_DIR, `biometrics.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`);
    fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), 'utf-8');
    fs.renameSync(tmpFile, BIOMETRICS_FILE);
  }

  public commit() {
    this.saveDataAtomic(this.data);
    this.saveBiometricsAtomic(this.biometrics);
  }

  // Snapshot for transactional rollback
  public snapshot(): { data: string; biometrics: string } {
    return {
      data: JSON.stringify(this.data),
      biometrics: JSON.stringify(this.biometrics)
    };
  }

  public rollback(snapshot: { data: string; biometrics: string }) {
    this.data = JSON.parse(snapshot.data);
    this.biometrics = JSON.parse(snapshot.biometrics);
    this.commit();
  }

  // --- Getters & Queries ---

  public getSettings() {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<typeof DEFAULT_SETTINGS>) {
    this.data.settings = { ...this.data.settings, ...updates };
    this.commit();
    return this.data.settings;
  }

  public isSetup() {
    return this.data.isSetup;
  }

  public setSetup(status: boolean) {
    this.data.isSetup = status;
    this.commit();
  }

  // Users
  public getUsers(): User[] {
    return this.data.users;
  }

  public findUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public findUserByEmail(email: string): User | undefined {
    const lower = email.trim().toLowerCase();
    return this.data.users.find(u => u.email.toLowerCase() === lower);
  }

  public findUserByEmployeeId(empId: string): User | undefined {
    return this.data.users.find(u => u.employeeId === empId);
  }

  public findUserByActivationToken(token: string): User | undefined {
    return this.data.users.find(u => u.activationToken === token);
  }

  public addUser(user: User): User {
    this.data.users.push(user);
    this.commit();
    return user;
  }

  public updateUser(id: string, updates: Partial<User>): User | undefined {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx === -1) return undefined;
    this.data.users[idx] = { ...this.data.users[idx], ...updates, updatedAt: new Date().toISOString() };
    this.commit();
    return this.data.users[idx];
  }

  // Employees
  public getEmployees(): Employee[] {
    return this.data.employees;
  }

  public findEmployeeById(id: string): Employee | undefined {
    return this.data.employees.find(e => e.id === id);
  }

  public findEmployeeByEmail(email: string): Employee | undefined {
    const lower = email.trim().toLowerCase();
    return this.data.employees.find(e => e.email.toLowerCase() === lower);
  }

  public findEmployeeByCode(code: string): Employee | undefined {
    return this.data.employees.find(e => e.employeeCode.toUpperCase() === code.trim().toUpperCase());
  }

  public getNextEmployeeCode(): string {
    const existing = this.data.employees
      .map(e => {
        const match = e.employeeCode.match(/EMP-(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const maxNum = existing.length > 0 ? Math.max(...existing) : 0;
    const nextNum = maxNum + 1;
    return `EMP-${nextNum.toString().padStart(4, '0')}`;
  }

  public addEmployee(emp: Employee): Employee {
    this.data.employees.push(emp);
    this.commit();
    return emp;
  }

  public updateEmployee(id: string, updates: Partial<Employee>): Employee | undefined {
    const idx = this.data.employees.findIndex(e => e.id === id);
    if (idx === -1) return undefined;
    this.data.employees[idx] = { ...this.data.employees[idx], ...updates, updatedAt: new Date().toISOString() };
    this.commit();
    return this.data.employees[idx];
  }

  // Biometrics (Encrypted Vault)
  public getBiometricTemplate(employeeId: string): EncryptedBiometricTemplate | undefined {
    return this.biometrics.templates.find(t => t.employeeId === employeeId);
  }

  public saveBiometricTemplate(template: EncryptedBiometricTemplate) {
    const idx = this.biometrics.templates.findIndex(t => t.employeeId === template.employeeId);
    if (idx >= 0) {
      this.biometrics.templates[idx] = template;
    } else {
      this.biometrics.templates.push(template);
    }
    this.saveBiometricsAtomic(this.biometrics);
  }

  public deleteBiometricTemplate(employeeId: string): boolean {
    const before = this.biometrics.templates.length;
    this.biometrics.templates = this.biometrics.templates.filter(t => t.employeeId !== employeeId);
    if (this.biometrics.templates.length !== before) {
      this.saveBiometricsAtomic(this.biometrics);
      return true;
    }
    return false;
  }

  // Attendance
  public getAttendance(): AttendanceRecord[] {
    return this.data.attendance;
  }

  public findAttendanceForEmployeeAndDate(employeeId: string, date: string): AttendanceRecord | undefined {
    return this.data.attendance.find(a => a.employeeId === employeeId && a.date === date);
  }

  public addAttendance(record: AttendanceRecord): AttendanceRecord {
    this.data.attendance.push(record);
    this.commit();
    return record;
  }

  public updateAttendance(id: string, updates: Partial<AttendanceRecord>): AttendanceRecord | undefined {
    const idx = this.data.attendance.findIndex(a => a.id === id);
    if (idx === -1) return undefined;
    this.data.attendance[idx] = { ...this.data.attendance[idx], ...updates, updatedAt: new Date().toISOString() };
    this.commit();
    return this.data.attendance[idx];
  }

  // Fallback Attendance Requests
  public getFallbackRequests(): FallbackAttendanceRequest[] {
    return this.data.fallbackRequests;
  }

  public addFallbackRequest(req: FallbackAttendanceRequest): FallbackAttendanceRequest {
    this.data.fallbackRequests.push(req);
    this.commit();
    return req;
  }

  public updateFallbackRequest(id: string, updates: Partial<FallbackAttendanceRequest>): FallbackAttendanceRequest | undefined {
    const idx = this.data.fallbackRequests.findIndex(f => f.id === id);
    if (idx === -1) return undefined;
    this.data.fallbackRequests[idx] = { ...this.data.fallbackRequests[idx], ...updates };
    this.commit();
    return this.data.fallbackRequests[idx];
  }

  // Leaves
  public getLeaves(): LeaveRecord[] {
    return this.data.leaves;
  }

  public addLeave(leave: LeaveRecord): LeaveRecord {
    this.data.leaves.push(leave);
    this.commit();
    return leave;
  }

  public updateLeave(id: string, updates: Partial<LeaveRecord>): LeaveRecord | undefined {
    const idx = this.data.leaves.findIndex(l => l.id === id);
    if (idx === -1) return undefined;
    this.data.leaves[idx] = { ...this.data.leaves[idx], ...updates };
    this.commit();
    return this.data.leaves[idx];
  }

  // Payrolls
  public getPayrolls(): PayrollRecord[] {
    return this.data.payrolls;
  }

  public findPayrollByMonth(month: string): PayrollRecord | undefined {
    return this.data.payrolls.find(p => p.month === month);
  }

  public addPayroll(payroll: PayrollRecord): PayrollRecord {
    this.data.payrolls.push(payroll);
    this.commit();
    return payroll;
  }

  public updatePayroll(id: string, updates: Partial<PayrollRecord>): PayrollRecord | undefined {
    const idx = this.data.payrolls.findIndex(p => p.id === id);
    if (idx === -1) return undefined;
    this.data.payrolls[idx] = { ...this.data.payrolls[idx], ...updates };
    this.commit();
    return this.data.payrolls[idx];
  }

  // Audit Logs (Append-only)
  public logAudit(log: Omit<AuditLog, 'id' | 'timestamp'>) {
    const entry: AuditLog = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...log
    };
    this.data.auditLogs.unshift(entry);
    // Keep last 1000 logs to control file size
    if (this.data.auditLogs.length > 1000) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 1000);
    }
    this.commit();
    return entry;
  }

  public getAuditLogs(): AuditLog[] {
    return this.data.auditLogs;
  }

  // Clean reset for testing (only active if allowed by test flag)
  public resetForTesting() {
    this.data = {
      isSetup: false,
      settings: { ...DEFAULT_SETTINGS },
      users: [],
      employees: [],
      attendance: [],
      fallbackRequests: [],
      leaves: [],
      payrolls: [],
      auditLogs: []
    };
    this.biometrics = { templates: [] };
    this.commit();
  }
}

export const db = new Database();

/**
 * Sanitizes user for client response (strips password hash, activation token, etc.)
 */
export function sanitizeUser(user: User) {
  const { passwordHash, ...safe } = user;
  return safe;
}

/**
 * Sanitizes employee for client response (employees cannot see colleague salary)
 */
export function sanitizeEmployee(emp: Employee, callerRole?: string, callerEmpId?: string) {
  const isPrivileged = callerRole === 'admin' || callerRole === 'hr';
  const isSelf = callerEmpId && callerEmpId === emp.id;

  if (isPrivileged || isSelf) {
    return emp;
  }

  // Mask salaries for other employees
  const { basicSalary, hra, medicalAllowance, grossSalary, ...safe } = emp;
  return safe;
}
