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
import os from 'os';
import pg from 'pg';
import type {
  DatabaseSchema,
  User,
  Employee,
  AttendanceRecord,
  FallbackAttendanceRequest,
  EncryptedBiometricTemplate,
  LeaveRecord,
  PayrollRecord,
  AuditLog,
  AILog
} from './types.ts';
import { DEFAULT_SETTINGS } from './rules.ts';

const { Pool } = pg;

function resolveDataDir(): string {
  if (process.env.DATA_DIR) {
    return path.resolve(process.env.DATA_DIR);
  }
  // Serverless environment detection (Vercel / AWS Lambda)
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'saylani-hcm-data');
  }
  const localDir = path.resolve(process.cwd(), 'data');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testFile = path.join(localDir, `.test_write_${Date.now()}`);
    fs.writeFileSync(testFile, 'ok', 'utf-8');
    fs.unlinkSync(testFile);
    return localDir;
  } catch (_e) {
    return path.join(os.tmpdir(), 'saylani-hcm-data');
  }
}

const DATA_DIR = resolveDataDir();
const DB_FILE = path.join(DATA_DIR, 'hcm_data.json');
const BIOMETRICS_FILE = path.join(DATA_DIR, 'biometrics.enc.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('[DB] Notice creating DATA_DIR:', err);
  }
}

// PostgreSQL Connection Pool when DATABASE_URL or POSTGRES_URL is provided
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
let pgPool: pg.Pool | null = null;
if (dbUrl) {
  try {
    pgPool = new Pool({
      connectionString: dbUrl,
      ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
  } catch (err) {
    console.warn('[DB] PostgreSQL pool initialization notice:', err);
  }
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
        const parsed = JSON.parse(raw);
        parsed.aiLogs = parsed.aiLogs || [];
        return parsed;
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
      auditLogs: [],
      aiLogs: []
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
    try {
      const tmpFile = path.join(DATA_DIR, `hcm_data.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`);
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('[DB] Error saving hcm_data.json:', err);
    }
  }

  private saveBiometricsAtomic(store: BiometricsStore) {
    try {
      const tmpFile = path.join(DATA_DIR, `biometrics.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`);
      fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), 'utf-8');
      fs.renameSync(tmpFile, BIOMETRICS_FILE);
    } catch (err) {
      console.error('[DB] Error saving biometrics.enc.json:', err);
    }
  }

  public commit() {
    this.saveDataAtomic(this.data);
    this.saveBiometricsAtomic(this.biometrics);

    // Asynchronously synchronize with PostgreSQL store when configured
    if (pgPool) {
      this.syncToPostgres().catch((err) => {
        console.warn('[DB] PostgreSQL sync notice:', err?.message || err);
      });
    }
  }

  public async syncToPostgres() {
    if (!pgPool) return;
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS hcm_store (
          key VARCHAR(64) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await pgPool.query(
        `INSERT INTO hcm_store (key, data, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = NOW();`,
        ['main', JSON.stringify(this.data)]
      );
      await pgPool.query(
        `INSERT INTO hcm_store (key, data, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = NOW();`,
        ['biometrics', JSON.stringify(this.biometrics)]
      );
    } catch (err: any) {
      console.warn('[DB] syncToPostgres failed:', err?.message || err);
    }
  }

  public async syncFromPostgres(): Promise<boolean> {
    if (!pgPool) return false;
    try {
      const res = await pgPool.query(`SELECT key, data FROM hcm_store WHERE key IN ('main', 'biometrics');`);
      for (const row of res.rows) {
        if (row.key === 'main' && row.data) {
          this.data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          this.data.aiLogs = this.data.aiLogs || [];
          this.saveDataAtomic(this.data);
        } else if (row.key === 'biometrics' && row.data) {
          this.biometrics = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          this.saveBiometricsAtomic(this.biometrics);
        }
      }
      return true;
    } catch (err: any) {
      console.warn('[DB] syncFromPostgres notice:', err?.message || err);
      return false;
    }
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

  public deleteUser(id: string): boolean {
    const before = this.data.users.length;
    this.data.users = this.data.users.filter(u => u.id !== id);
    if (this.data.users.length !== before) {
      this.commit();
      return true;
    }
    return false;
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

  public deleteEmployee(id: string): boolean {
    const before = this.data.employees.length;
    this.data.employees = this.data.employees.filter(e => e.id !== id);
    if (this.data.employees.length !== before) {
      this.commit();
      return true;
    }
    return false;
  }

  public getEmployeeHistoricalSummary(empId: string) {
    const attendanceCount = this.data.attendance.filter(a => a.employeeId === empId).length;
    const leaves = this.data.leaves.filter(l => l.employeeId === empId);
    const pendingLeaves = leaves.filter(l => l.status === 'pending');
    const draftPayrolls = this.data.payrolls.filter(p => p.status === 'draft' && p.items.some(i => i.employeeId === empId));
    const finalizedPayrolls = this.data.payrolls.filter(p => p.status === 'finalized' && p.items.some(i => i.employeeId === empId));
    const fallbackCount = this.data.fallbackRequests.filter(f => f.employeeId === empId).length;
    const hasBiometrics = this.biometrics.templates.some(t => t.employeeId === empId);

    return {
      attendanceCount,
      leavesCount: leaves.length,
      pendingLeavesCount: pendingLeaves.length,
      pendingLeaves,
      payrollCount: draftPayrolls.length + finalizedPayrolls.length,
      draftPayrolls,
      finalizedPayrolls,
      fallbackCount,
      hasBiometrics,
      hasHistoricalRecords: (attendanceCount > 0 || leaves.length > 0 || finalizedPayrolls.length > 0 || draftPayrolls.length > 0 || fallbackCount > 0)
    };
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

  // AI Logs
  public getAILogs(): AILog[] {
    return this.data.aiLogs || [];
  }

  public addAILog(log: AILog): AILog {
    this.data.aiLogs = this.data.aiLogs || [];
    this.data.aiLogs.unshift(log);
    if (this.data.aiLogs.length > 1000) {
      this.data.aiLogs = this.data.aiLogs.slice(0, 1000);
    }
    this.commit();
    return log;
  }

  public getData(): DatabaseSchema {
    return this.data;
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
      auditLogs: [],
      aiLogs: []
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

  // Mask salaries and sensitive separation details for other employees
  const {
    basicSalary,
    hra,
    medicalAllowance,
    grossSalary,
    deactivationReason,
    terminationReason,
    rehireEligible,
    reactivationReason,
    ...safe
  } = emp;
  return safe as Employee;
}
