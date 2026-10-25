/**
 * Saylani HCM Lite - Primary API Router
 * Implements Authentication, Employee Lifecycle, Biometric Enrollment & Verification,
 * Server-Authoritative Attendance, Fallbacks, Leave Management, Payroll, and Audit Logs.
 */

import { Router, type Request, type Response } from 'express';
import { db, sanitizeUser, sanitizeEmployee } from './db.ts';
import {
  hashPassword,
  verifyPassword,
  signJwt,
  generateActivationCredentials,
  signBiometricProofToken,
  verifyBiometricProofToken,
  encryptBiometricTemplate,
  decryptBiometricTemplate,
  validateBiometricVector,
  verifyBiometricMatch
} from './security.ts';
import {
  evaluateCheckIn,
  evaluateCheckOut,
  calculateSalaryStructure,
  calculateMonthlyTax,
  getLocalizedDateTime
} from './rules.ts';
import {
  authenticateToken,
  requireRole,
  requireSelfOrAdminOrHr,
  createRateLimiter
} from './auth.ts';
import type { AttendanceRecord, FallbackAttendanceRequest } from './types.ts';

export const apiRouter = Router();

// Rate limiters for sensitive endpoints
const loginLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000,
  message: 'Too many login attempts. Please wait 1 minute before trying again.'
});

const biometricLimiter = createRateLimiter({
  maxRequests: 20,
  windowMs: 60 * 1000,
  message: 'Too many face verification attempts. Please wait 1 minute.'
});

// ==========================================
// 1. SYSTEM SETUP & AUTHENTICATION ROUTES
// ==========================================

/**
 * Health check
 */
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * Check if initial Admin setup has occurred
 */
apiRouter.get('/auth/setup-status', (_req: Request, res: Response) => {
  const users = db.getUsers();
  const hasAdmin = users.some(u => u.role === 'admin');
  res.json({ isSetup: db.isSetup() || hasAdmin });
});

/**
 * First-run setup: creates initial Admin account
 * Prevents unauthorized duplicate admin creation once setup is complete
 */
apiRouter.post('/auth/setup', async (req: Request, res: Response) => {
  const users = db.getUsers();
  const hasAdmin = users.some(u => u.role === 'admin');

  if (hasAdmin || db.isSetup()) {
    return res.status(400).json({ error: 'System setup has already been completed. Cannot create second initial Admin.' });
  }

  const { fullName, email, password } = req.body;
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const adminUser = db.addUser({
    id: `USR-${Date.now()}-ADMIN`,
    email: email.trim().toLowerCase(),
    passwordHash,
    role: 'admin',
    fullName: fullName.trim(),
    mustChangePassword: false,
    isActive: true,
    createdAt: now,
    updatedAt: now
  });

  db.setSetup(true);

  db.logAudit({
    userId: adminUser.id,
    userEmail: adminUser.email,
    userRole: adminUser.role,
    action: 'SYSTEM_FIRST_RUN_SETUP',
    entityType: 'User',
    entityId: adminUser.id,
    details: 'Initial Admin account provisioned during system setup.'
  });

  const token = signJwt({
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
    fullName: adminUser.fullName
  });

  res.status(201).json({
    message: 'Initial Admin account created successfully.',
    token,
    user: sanitizeUser(adminUser)
  });
});

/**
 * Standard Email & Password Login
 */
apiRouter.post('/auth/login', loginLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.findUserByEmail(email);
  if (!user || !user.isActive) {
    // Avoid leaking whether account exists
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Fetch linked employee details if role is employee
  let linkedEmployee = null;
  if (user.employeeId) {
    linkedEmployee = db.findEmployeeById(user.employeeId);
  }

  const token = signJwt({
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    fullName: user.fullName
  });

  db.logAudit({
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    action: 'USER_LOGIN_SUCCESS',
    entityType: 'User',
    entityId: user.id,
    details: `User signed in successfully. Must change password: ${user.mustChangePassword}`
  });

  res.json({
    token,
    user: sanitizeUser(user),
    employee: linkedEmployee ? sanitizeEmployee(linkedEmployee, user.role, user.employeeId) : null,
    mustChangePassword: user.mustChangePassword
  });
});

/**
 * Account Activation via Invitation Token
 */
apiRouter.post('/auth/activate', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Activation token and new password are required.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  const user = db.findUserByActivationToken(token);
  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired activation token.' });
  }

  if (user.activationTokenExpires && new Date(user.activationTokenExpires).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Activation token has expired. Please ask HR/Admin to resend.' });
  }

  const newHash = await hashPassword(newPassword);
  db.updateUser(user.id, {
    passwordHash: newHash,
    mustChangePassword: false,
    activationToken: undefined,
    activationTokenExpires: undefined,
    isActive: true
  });

  db.logAudit({
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    action: 'ACCOUNT_ACTIVATED',
    entityType: 'User',
    entityId: user.id,
    details: 'Employee account activated and password set via one-time invitation link.'
  });

  const sessionToken = signJwt({
    id: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    fullName: user.fullName
  });

  res.json({
    message: 'Account activated successfully! You may now sign in and set up biometric attendance.',
    token: sessionToken,
    user: sanitizeUser(user)
  });
});

/**
 * Force Change Password (for initial temporary password or user initiated)
 */
apiRouter.post('/auth/change-password', authenticateToken, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  const user = db.findUserById(req.user!.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // If user is forced to change initial password, currentPassword validation is optional if matching temporary password
  if (currentPassword) {
    const isCurrentValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return res.status(400).json({ error: 'Current password does not match.' });
    }
  }

  const newHash = await hashPassword(newPassword);
  db.updateUser(user.id, {
    passwordHash: newHash,
    mustChangePassword: false
  });

  db.logAudit({
    userId: user.id,
    userEmail: user.email,
    userRole: user.role,
    action: 'PASSWORD_CHANGED',
    entityType: 'User',
    entityId: user.id,
    details: 'User successfully updated account password.'
  });

  res.json({ message: 'Password updated successfully.' });
});

/**
 * Get Current Authenticated Profile
 */
apiRouter.get('/auth/me', authenticateToken, (req: Request, res: Response) => {
  const user = db.findUserById(req.user!.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  let employee = null;
  if (user.employeeId) {
    const emp = db.findEmployeeById(user.employeeId);
    if (emp) {
      employee = sanitizeEmployee(emp, user.role, user.employeeId);
    }
  }

  res.json({
    user: sanitizeUser(user),
    employee,
    mustChangePassword: user.mustChangePassword
  });
});

// ==========================================
// 2. EMPLOYEE REGISTRATION & MANAGEMENT
// ==========================================

/**
 * List Employees
 * Admin & HR see full roster with login accounts & salaries.
 * Employees see employee directory without colleague salary structures.
 */
apiRouter.get('/employees', authenticateToken, (req: Request, res: Response) => {
  const employees = db.getEmployees();
  const callerRole = req.user!.role;
  const callerEmpId = req.user!.employeeId;

  const sanitized = employees.map(emp => {
    const safeEmp = sanitizeEmployee(emp, callerRole, callerEmpId);
    // Include user account summary for Admin/HR
    if (callerRole === 'admin' || callerRole === 'hr') {
      const user = db.findUserByEmployeeId(emp.id);
      return {
        ...safeEmp,
        userAccount: user ? {
          id: user.id,
          email: user.email,
          isActive: user.isActive,
          mustChangePassword: user.mustChangePassword,
          hasActivationToken: Boolean(user.activationToken),
          activationTokenExpires: user.activationTokenExpires
        } : null
      };
    }
    return safeEmp;
  });

  res.json(sanitized);
});

/**
 * Register New Employee & ATOMICALLY Create Linked Login Account
 * Must be executed by Admin or HR.
 * Enforces:
 * - Least-privileged Employee role on the server. Never accepts arbitrary roles.
 * - Unique employee code and email.
 * - Generates secure one-time activation token and temporary password hash.
 * - Safe rollback if employee or user creation fails.
 * - Records audit event without logging secrets.
 */
apiRouter.post('/employees', authenticateToken, requireRole('admin', 'hr'), async (req: Request, res: Response) => {
  const {
    firstName,
    lastName,
    email,
    department,
    designation,
    dateOfJoining,
    basicSalary
  } = req.body;

  // Validation
  if (!firstName || !lastName || !email || !department || !designation) {
    return res.status(400).json({ error: 'First name, last name, work email, department, and designation are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: 'Invalid work email format.' });
  }

  // Check email uniqueness across both employees and users
  const existingEmp = db.findEmployeeByEmail(cleanEmail);
  const existingUser = db.findUserByEmail(cleanEmail);
  if (existingEmp || existingUser) {
    return res.status(409).json({ error: 'An employee or login account with this email already exists.' });
  }

  const numericBasic = Number(basicSalary) || 50000;
  const salaryStructure = calculateSalaryStructure(numericBasic);
  const employeeCode = db.getNextEmployeeCode();
  const employeeId = `EMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const userId = `USR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  // Generate secure activation credentials
  const { rawToken, expiresAt, tempPassword } = generateActivationCredentials();
  const passwordHash = await hashPassword(tempPassword);

  // Take snapshot for rollback safety
  const snapshot = db.snapshot();

  try {
    // 1. Create linked Employee-role User
    const newUser = db.addUser({
      id: userId,
      email: cleanEmail,
      passwordHash,
      role: 'employee', // Strictly enforced on server; client cannot grant admin/hr
      employeeId,
      fullName: `${firstName.trim()} ${lastName.trim()}`,
      mustChangePassword: true, // Forced password change on first login
      activationToken: rawToken,
      activationTokenExpires: expiresAt,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });

    // 2. Create Employee record
    const newEmployee = db.addEmployee({
      id: employeeId,
      employeeCode,
      userId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: cleanEmail,
      department: department.trim(),
      designation: designation.trim(),
      dateOfJoining: dateOfJoining || now.slice(0, 10),
      ...salaryStructure,
      status: 'active',
      faceEnrolled: false,
      biometricConsent: false,
      createdAt: now,
      updatedAt: now
    });

    // 3. Audit log (without logging raw passwords or tokens)
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'EMPLOYEE_REGISTERED_WITH_LOGIN',
      entityType: 'Employee',
      entityId: employeeId,
      details: `Registered employee ${employeeCode} (${cleanEmail}) and automatically provisioned linked Employee login account.`
    });

    res.status(201).json({
      message: 'Employee registered and linked login account created successfully.',
      employee: newEmployee,
      user: sanitizeUser(newUser),
      invitation: {
        activationToken: rawToken,
        temporaryPassword: tempPassword,
        expiresAt,
        activationUrl: `/activate?token=${rawToken}`
      }
    });
  } catch (err: any) {
    // Rollback to prevent orphan records
    db.rollback(snapshot);
    console.error('[Employee Registration] Rollback triggered:', err);
    res.status(500).json({ error: 'Failed to create employee and user account. Transaction rolled back.' });
  }
});

/**
 * Resend / View Account Activation Link
 */
apiRouter.post('/employees/:id/resend-invite', authenticateToken, requireRole('admin', 'hr'), (req: Request, res: Response) => {
  const employee = db.findEmployeeById(req.params.id);
  if (!employee) return res.status(404).json({ error: 'Employee not found.' });

  const user = db.findUserByEmployeeId(employee.id);
  if (!user) return res.status(404).json({ error: 'No linked user account found for this employee.' });

  const { rawToken, expiresAt, tempPassword } = generateActivationCredentials();
  
  db.updateUser(user.id, {
    activationToken: rawToken,
    activationTokenExpires: expiresAt,
    mustChangePassword: true
  });

  db.logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'INVITATION_LINK_REFRESHED',
    entityType: 'User',
    entityId: user.id,
    details: `Refreshed activation credentials for employee ${employee.employeeCode}.`
  });

  res.json({
    message: 'New activation link generated.',
    invitation: {
      activationToken: rawToken,
      temporaryPassword: tempPassword,
      expiresAt,
      activationUrl: `/activate?token=${rawToken}`
    }
  });
});

/**
 * Get Specific Employee Record
 */
apiRouter.get('/employees/:id', authenticateToken, requireSelfOrAdminOrHr('id'), (req: Request, res: Response) => {
  const employee = db.findEmployeeById(req.params.id);
  if (!employee) return res.status(404).json({ error: 'Employee not found.' });

  res.json(sanitizeEmployee(employee, req.user!.role, req.user!.employeeId));
});

// ==========================================
// 3. BIOMETRIC ENROLLMENT & VERIFICATION
// ==========================================

/**
 * Check Biometric Status for Current Employee
 */
apiRouter.get('/biometrics/status', authenticateToken, (req: Request, res: Response) => {
  const employeeId = req.user!.employeeId;
  if (!employeeId) {
    return res.status(400).json({ error: 'User is not linked to an employee record.' });
  }

  const employee = db.findEmployeeById(employeeId);
  if (!employee) return res.status(404).json({ error: 'Employee not found.' });

  const template = db.getBiometricTemplate(employeeId);

  res.json({
    employeeId,
    faceEnrolled: employee.faceEnrolled,
    biometricConsent: employee.biometricConsent,
    biometricConsentDate: employee.biometricConsentDate,
    enrolledAt: template ? template.enrolledAt : null,
    qualityScore: template ? template.qualityScore : null,
    samplesCount: template ? template.samplesCount : null,
    retentionPolicyDays: 365,
    cameraRequirementNotice: 'Browser camera access requires localhost or HTTPS in supported browsers.'
  });
});

/**
 * Enroll Employee Face Biometric Template
 * - Requires explicit, informed consent.
 * - Validates 128-dimensional facial descriptor vector.
 * - Encrypts template with AES-256-GCM at rest in protected storage.
 * - Strips all raw video/images (never saved).
 * - Audits event without exposing biometric data.
 */
apiRouter.post('/biometrics/enroll', authenticateToken, biometricLimiter, async (req: Request, res: Response) => {
  const employeeId = req.user!.employeeId;
  if (!employeeId) {
    return res.status(400).json({ error: 'Authenticated user is not linked to an employee record.' });
  }

  const employee = db.findEmployeeById(employeeId);
  if (!employee) return res.status(404).json({ error: 'Employee not found.' });

  const { descriptor, consentGiven, qualityScore, samplesCount } = req.body;

  // 1. Consent verification
  if (!consentGiven) {
    return res.status(400).json({
      error: 'Explicit informed biometric consent is strictly required for facial enrollment.'
    });
  }

  // 2. Validate descriptor quality
  const validation = validateBiometricVector(descriptor);
  if (!validation.valid) {
    return res.status(400).json({ error: `Biometric validation failed: ${validation.error}` });
  }

  const safeQuality = Number(qualityScore) || 85;
  const safeSamples = Number(samplesCount) || 3;

  // 3. Encrypt template with AES-256-GCM
  const encryptedRecord = encryptBiometricTemplate(descriptor, {
    employeeId,
    qualityScore: safeQuality,
    samplesCount: safeSamples
  });

  // 4. Save to protected biometric vault
  db.saveBiometricTemplate(encryptedRecord);

  // 5. Update employee record
  const now = new Date().toISOString();
  db.updateEmployee(employeeId, {
    faceEnrolled: true,
    biometricConsent: true,
    biometricConsentDate: now
  });

  // 6. Audit event
  db.logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'BIOMETRIC_FACE_ENROLLED',
    entityType: 'Employee',
    entityId: employeeId,
    details: `Biometric facial descriptor template enrolled and encrypted with AES-256-GCM (Quality: ${safeQuality}%, Samples: ${safeSamples}).`
  });

  res.json({
    success: true,
    message: 'Face enrolled successfully with protected encrypted storage.',
    enrolledAt: now
  });
});

/**
 * Verify Live Face Descriptor Against Enrolled Template
 * Client extracts candidate 128D descriptor from live webcam and submits to server.
 * Server decrypts enrolled template, computes Euclidean distance & Cosine similarity.
 * On match, signs a 60-second single-use verification proof token.
 */
apiRouter.post('/biometrics/verify', authenticateToken, biometricLimiter, (req: Request, res: Response) => {
  const employeeId = req.user!.employeeId;
  if (!employeeId) {
    return res.status(400).json({ error: 'User is not linked to an employee record.' });
  }

  const { descriptor, action } = req.body;
  if (!action || !['check_in', 'check_out'].includes(action)) {
    return res.status(400).json({ error: 'Action must be check_in or check_out.' });
  }

  const validation = validateBiometricVector(descriptor);
  if (!validation.valid) {
    return res.status(400).json({ error: `Invalid candidate biometric vector: ${validation.error}` });
  }

  // Retrieve encrypted template from protected vault
  const encryptedTemplate = db.getBiometricTemplate(employeeId);
  if (!encryptedTemplate) {
    return res.status(404).json({
      error: 'No enrolled face template found. Please enroll your face first or use the fallback attendance method.'
    });
  }

  // Decrypt template on server
  let enrolledVector: number[];
  try {
    enrolledVector = decryptBiometricTemplate(encryptedTemplate);
  } catch (err) {
    console.error('[Biometrics] Decryption failure:', err);
    return res.status(500).json({ error: 'Failed to access biometric vault. Please contact administrator.' });
  }

  // Mathematical comparison
  const settings = db.getSettings();
  const threshold = settings.biometricPolicy.matchingThreshold || 0.45;
  const matchResult = verifyBiometricMatch(descriptor, enrolledVector, threshold);

  if (!matchResult.match) {
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'BIOMETRIC_VERIFICATION_FAILED',
      entityType: 'Attendance',
      entityId: employeeId,
      details: `Face mismatch for ${action}. Distance: ${matchResult.distance.toFixed(4)} (Threshold: ${threshold}).`
    });

    return res.status(422).json({
      verified: false,
      error: 'Face verification failed: biometric template mismatch.',
      distance: Number(matchResult.distance.toFixed(4)),
      similarity: Number(matchResult.similarity.toFixed(4))
    });
  }

  // Verification succeeded: Issue 60-second single-use proof token
  const proofToken = signBiometricProofToken(employeeId, action);

  res.json({
    verified: true,
    verificationToken: proofToken,
    distance: Number(matchResult.distance.toFixed(4)),
    similarity: Number(matchResult.similarity.toFixed(4)),
    expiresInSeconds: 60
  });
});

/**
 * Withdraw Biometric Consent & Permanently Delete Template
 */
apiRouter.delete('/biometrics/consent', authenticateToken, (req: Request, res: Response) => {
  const employeeId = req.user!.employeeId;
  if (!employeeId) {
    return res.status(400).json({ error: 'User is not linked to an employee record.' });
  }

  const deleted = db.deleteBiometricTemplate(employeeId);
  db.updateEmployee(employeeId, {
    faceEnrolled: false,
    biometricConsent: false
  });

  db.logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'BIOMETRIC_CONSENT_WITHDRAWN',
    entityType: 'Employee',
    entityId: employeeId,
    details: 'Employee withdrew biometric consent. Face template permanently deleted from vault.'
  });

  res.json({
    success: true,
    message: 'Biometric consent withdrawn and face template permanently deleted.',
    deleted
  });
});

// ==========================================
// 4. ATTENDANCE (CHECK-IN / CHECK-OUT)
// ==========================================

/**
 * Check In
 * Server-authoritative timestamp.
 * Requires biometric verification proof OR verified fallback.
 * Client cannot spoof attendance by simply sending faceVerified: true.
 */
apiRouter.post('/attendance/check-in', authenticateToken, (req: Request, res: Response) => {
  const employeeId = req.user!.employeeId;
  if (!employeeId) {
    return res.status(400).json({ error: 'User is not linked to an employee record.' });
  }

  const employee = db.findEmployeeById(employeeId);
  if (!employee || employee.status !== 'active') {
    return res.status(400).json({ error: 'Active employee record required for attendance.' });
  }

  const { verificationToken } = req.body;

  // Validate server-signed biometric proof token
  if (!verificationToken) {
    return res.status(422).json({
      error: 'Face verification proof is required. Please verify your face before checking in or use the fallback option.'
    });
  }

  const isValidProof = verifyBiometricProofToken(verificationToken, employeeId, 'check_in');
  if (!isValidProof) {
    return res.status(403).json({
      error: 'Biometric verification proof is invalid, expired, or was generated for another action.'
    });
  }

  // Authoritative server timestamp (UTC)
  const nowUtc = new Date().toISOString();
  const settings = db.getSettings();
  const checkInEval = evaluateCheckIn(nowUtc, settings);

  // Check duplicate check-in for the current date
  const existingRecord = db.findAttendanceForEmployeeAndDate(employeeId, checkInEval.date);
  if (existingRecord) {
    return res.status(409).json({
      error: `Attendance already recorded for today (${checkInEval.date}). Duplicate check-in rejected.`,
      record: existingRecord
    });
  }

  const record: AttendanceRecord = {
    id: `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    employeeId,
    date: checkInEval.date,
    checkInTime: nowUtc,
    status: checkInEval.status,
    checkInMethod: 'face_verified',
    isLate: checkInEval.isLate,
    lateMinutes: checkInEval.lateMinutes,
    isHalfDay: false,
    missingCheckOut: true,
    createdAt: nowUtc,
    updatedAt: nowUtc
  };

  db.addAttendance(record);

  db.logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'ATTENDANCE_CHECK_IN',
    entityType: 'Attendance',
    entityId: record.id,
    details: `Employee ${employee.employeeCode} checked in at ${checkInEval.time} (${checkInEval.status.toUpperCase()}, Late: ${checkInEval.lateMinutes}m) via Face Verification.`
  });

  res.status(201).json({
    message: `Check-in successful! Status: ${checkInEval.status.toUpperCase()}`,
    record
  });
});

/**
 * Check Out
 * Server-authoritative timestamp.
 * Requires biometric verification proof.
 * Evaluates total hours and marks half-day if < 5 hours.
 */
apiRouter.post('/attendance/check-out', authenticateToken, (req: Request, res: Response) => {
  const employeeId = req.user!.employeeId;
  if (!employeeId) {
    return res.status(400).json({ error: 'User is not linked to an employee record.' });
  }

  const { verificationToken } = req.body;
  if (!verificationToken) {
    return res.status(422).json({
      error: 'Face verification proof is required. Please verify your face before checking out.'
    });
  }

  const isValidProof = verifyBiometricProofToken(verificationToken, employeeId, 'check_out');
  if (!isValidProof) {
    return res.status(403).json({
      error: 'Biometric verification proof is invalid or expired for check-out.'
    });
  }

  // Authoritative server timestamp (UTC)
  const nowUtc = new Date().toISOString();
  const settings = db.getSettings();
  const { dateStr, timeStr } = getLocalizedDateTime(nowUtc, settings.timezone);

  const existingRecord = db.findAttendanceForEmployeeAndDate(employeeId, dateStr);
  if (!existingRecord) {
    return res.status(400).json({
      error: `No check-in record found for today (${dateStr}). You must check in first before checking out.`
    });
  }

  if (existingRecord.checkOutTime) {
    return res.status(409).json({
      error: `Check-out has already been recorded for today at ${existingRecord.checkOutTime}.`,
      record: existingRecord
    });
  }

  // Evaluate work duration and half-day status
  const checkOutEval = evaluateCheckOut(
    existingRecord.checkInTime!,
    nowUtc,
    existingRecord.status,
    settings
  );

  const updatedRecord = db.updateAttendance(existingRecord.id, {
    checkOutTime: nowUtc,
    checkOutMethod: 'face_verified',
    workHoursMinutes: checkOutEval.workHoursMinutes,
    isHalfDay: checkOutEval.isHalfDay,
    status: checkOutEval.status,
    missingCheckOut: false
  });

  db.logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'ATTENDANCE_CHECK_OUT',
    entityType: 'Attendance',
    entityId: existingRecord.id,
    details: `Employee checked out at ${timeStr}. Work hours: ${checkOutEval.workHours}h. Final Status: ${checkOutEval.status.toUpperCase()}.`
  });

  res.json({
    message: `Check-out successful! Total work duration: ${checkOutEval.workHours} hours.`,
    record: updatedRecord
  });
});

/**
 * Authorized Fallback Attendance Request
 * Used when camera is denied, hardware failure, verification failure, consent withdrawn, or disability need.
 */
apiRouter.post('/attendance/fallback-request', authenticateToken, (req: Request, res: Response) => {
  const employeeId = req.user!.employeeId;
  if (!employeeId) {
    return res.status(400).json({ error: 'User is not linked to an employee record.' });
  }

  const { actionType, reason, reasonDetails } = req.body;
  if (!actionType || !['check_in', 'check_out'].includes(actionType)) {
    return res.status(400).json({ error: 'Action type must be check_in or check_out.' });
  }
  if (!reason || !reasonDetails) {
    return res.status(400).json({ error: 'Fallback reason and detailed explanation are required.' });
  }

  const nowUtc = new Date().toISOString();
  const settings = db.getSettings();
  const { dateStr, timeStr } = getLocalizedDateTime(nowUtc, settings.timezone);

  // If check-in, check duplicate
  if (actionType === 'check_in') {
    const existing = db.findAttendanceForEmployeeAndDate(employeeId, dateStr);
    if (existing) {
      return res.status(409).json({ error: `Attendance already recorded for today (${dateStr}).` });
    }

    const checkInEval = evaluateCheckIn(nowUtc, settings);
    const attRecord: AttendanceRecord = {
      id: `ATT-FB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      employeeId,
      date: dateStr,
      checkInTime: nowUtc,
      status: checkInEval.status,
      checkInMethod: 'manual_fallback',
      isLate: checkInEval.isLate,
      lateMinutes: checkInEval.lateMinutes,
      isHalfDay: false,
      missingCheckOut: true,
      notes: `Fallback check-in (${reason}): ${reasonDetails}`,
      createdAt: nowUtc,
      updatedAt: nowUtc
    };

    db.addAttendance(attRecord);

    const fallbackReq: FallbackAttendanceRequest = {
      id: `FBR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      employeeId,
      date: dateStr,
      actionType: 'check_in',
      requestedTimestamp: nowUtc,
      reason,
      reasonDetails: reasonDetails.trim(),
      status: 'pending',
      createdAt: nowUtc
    };
    db.addFallbackRequest(fallbackReq);

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'FALLBACK_ATTENDANCE_CHECK_IN',
      entityType: 'Attendance',
      entityId: attRecord.id,
      details: `Fallback check-in recorded for reason '${reason}': ${reasonDetails}. Flagged for HR review.`
    });

    return res.status(201).json({
      message: 'Fallback check-in recorded and logged for HR review.',
      record: attRecord,
      fallbackRequest: fallbackReq
    });
  }

  // If check-out
  if (actionType === 'check_out') {
    const existing = db.findAttendanceForEmployeeAndDate(employeeId, dateStr);
    if (!existing) {
      return res.status(400).json({ error: 'No check-in record found for today.' });
    }
    if (existing.checkOutTime) {
      return res.status(409).json({ error: 'Check-out already recorded for today.' });
    }

    const checkOutEval = evaluateCheckOut(existing.checkInTime!, nowUtc, existing.status, settings);
    const updated = db.updateAttendance(existing.id, {
      checkOutTime: nowUtc,
      checkOutMethod: 'manual_fallback',
      workHoursMinutes: checkOutEval.workHoursMinutes,
      isHalfDay: checkOutEval.isHalfDay,
      status: checkOutEval.status,
      missingCheckOut: false,
      notes: (existing.notes ? existing.notes + ' | ' : '') + `Fallback check-out (${reason}): ${reasonDetails}`
    });

    const fallbackReq: FallbackAttendanceRequest = {
      id: `FBR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      employeeId,
      date: dateStr,
      actionType: 'check_out',
      requestedTimestamp: nowUtc,
      reason,
      reasonDetails: reasonDetails.trim(),
      status: 'pending',
      createdAt: nowUtc
    };
    db.addFallbackRequest(fallbackReq);

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'FALLBACK_ATTENDANCE_CHECK_OUT',
      entityType: 'Attendance',
      entityId: existing.id,
      details: `Fallback check-out recorded for reason '${reason}': ${reasonDetails}. Work hours: ${checkOutEval.workHours}h.`
    });

    return res.json({
      message: 'Fallback check-out recorded and logged for HR review.',
      record: updated,
      fallbackRequest: fallbackReq
    });
  }
});

/**
 * Today's Attendance Roster
 * Admin/HR sees entire company. Employee sees their own record.
 */
apiRouter.get('/attendance/today', authenticateToken, (req: Request, res: Response) => {
  const settings = db.getSettings();
  const { dateStr } = getLocalizedDateTime(new Date(), settings.timezone);
  const allAtt = db.getAttendance().filter(a => a.date === dateStr);
  const callerRole = req.user!.role;
  const callerEmpId = req.user!.employeeId;

  if (callerRole === 'admin' || callerRole === 'hr') {
    const employees = db.getEmployees();
    const roster = employees.map(emp => {
      const att = allAtt.find(a => a.employeeId === emp.id);
      return {
        employee: {
          id: emp.id,
          employeeCode: emp.employeeCode,
          firstName: emp.firstName,
          lastName: emp.lastName,
          department: emp.department,
          designation: emp.designation,
          faceEnrolled: emp.faceEnrolled
        },
        attendance: att || null
      };
    });
    return res.json({ date: dateStr, roster, totalEmployees: employees.length });
  }

  // Employee only sees self
  const myAtt = allAtt.find(a => a.employeeId === callerEmpId);
  res.json({ date: dateStr, attendance: myAtt || null });
});

/**
 * Attendance History
 * Query params: employeeId, startDate, endDate
 */
apiRouter.get('/attendance/history', authenticateToken, (req: Request, res: Response) => {
  const callerRole = req.user!.role;
  const callerEmpId = req.user!.employeeId;
  const requestedEmpId = req.query.employeeId as string | undefined;

  let targetEmpId = callerEmpId;
  if (callerRole === 'admin' || callerRole === 'hr') {
    targetEmpId = requestedEmpId || undefined;
  } else if (requestedEmpId && requestedEmpId !== callerEmpId) {
    return res.status(403).json({ error: "Forbidden: You cannot view another employee's attendance history." });
  }

  let list = db.getAttendance();
  if (targetEmpId) {
    list = list.filter(a => a.employeeId === targetEmpId);
  }

  // Sort descending by date
  list.sort((a, b) => b.date.localeCompare(a.date));

  res.json(list);
});

/**
 * List Fallback Requests (Admin & HR)
 */
apiRouter.get('/attendance/fallbacks', authenticateToken, requireRole('admin', 'hr'), (_req: Request, res: Response) => {
  const requests = db.getFallbackRequests();
  const employees = db.getEmployees();
  
  const enriched = requests.map(r => {
    const emp = employees.find(e => e.id === r.employeeId);
    return {
      ...r,
      employee: emp ? {
        id: emp.id,
        employeeCode: emp.employeeCode,
        fullName: `${emp.firstName} ${emp.lastName}`,
        department: emp.department
      } : null
    };
  });

  res.json(enriched);
});

/**
 * Review / Approve Fallback Request (Admin & HR)
 */
apiRouter.put('/attendance/fallbacks/:id', authenticateToken, requireRole('admin', 'hr'), (req: Request, res: Response) => {
  const { status, reviewNotes } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected.' });
  }

  const updated = db.updateFallbackRequest(req.params.id, {
    status,
    reviewNotes: reviewNotes || '',
    reviewedBy: req.user!.fullName,
    reviewedAt: new Date().toISOString()
  });

  if (!updated) {
    return res.status(404).json({ error: 'Fallback request not found.' });
  }

  db.logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: `FALLBACK_ATTENDANCE_${status.toUpperCase()}`,
    entityType: 'FallbackAttendanceRequest',
    entityId: updated.id,
    details: `Fallback request for employee ${updated.employeeId} was ${status}. Notes: ${reviewNotes || 'None'}`
  });

  res.json({ message: `Fallback attendance request ${status}.`, fallbackRequest: updated });
});

// ==========================================
// 5. ORGANIZATION & SETTINGS
// ==========================================

apiRouter.get('/organization/settings', authenticateToken, (_req: Request, res: Response) => {
  res.json(db.getSettings());
});

apiRouter.put('/organization/settings', authenticateToken, requireRole('admin'), (req: Request, res: Response) => {
  const updated = db.updateSettings(req.body);
  db.logAudit({
    userId: req.user!.id,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'SETTINGS_UPDATED',
    entityType: 'CompanySettings',
    details: 'Company work hours, timezone, or biometric policy updated.'
  });
  res.json({ message: 'Settings updated successfully.', settings: updated });
});

// ==========================================
// 6. LEAVES & PAYROLL
// ==========================================

apiRouter.get('/leaves', authenticateToken, (req: Request, res: Response) => {
  const callerRole = req.user!.role;
  const callerEmpId = req.user!.employeeId;
  let leaves = db.getLeaves();

  if (callerRole === 'employee') {
    leaves = leaves.filter(l => l.employeeId === callerEmpId);
  }
  res.json(leaves);
});

apiRouter.post('/leaves', authenticateToken, (req: Request, res: Response) => {
  const employeeId = req.user!.employeeId;
  if (!employeeId) return res.status(400).json({ error: 'Employee record required.' });

  const { leaveType, startDate, endDate, reason, workingDays } = req.body;
  if (!leaveType || !startDate || !endDate) {
    return res.status(400).json({ error: 'Leave type, start date, and end date are required.' });
  }

  const leave: any = {
    id: `LEV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    employeeId,
    leaveType,
    startDate,
    endDate,
    workingDays: Number(workingDays) || 1,
    reason: reason || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.addLeave(leave);
  res.status(201).json(leave);
});

apiRouter.put('/leaves/:id/approve', authenticateToken, requireRole('admin', 'hr'), (req: Request, res: Response) => {
  const leave = db.updateLeave(req.params.id, {
    status: 'approved',
    approvedBy: req.user!.fullName,
    approvedAt: new Date().toISOString()
  });
  if (!leave) return res.status(404).json({ error: 'Leave not found.' });
  res.json(leave);
});

// Payroll endpoints
apiRouter.get('/payroll', authenticateToken, requireRole('admin', 'hr'), (req: Request, res: Response) => {
  res.json(db.getPayrolls());
});

apiRouter.post('/payroll/generate', authenticateToken, requireRole('admin', 'hr'), (req: Request, res: Response) => {
  const { month } = req.body; // YYYY-MM
  if (!month) return res.status(400).json({ error: 'Month (YYYY-MM) is required.' });

  const existing = db.findPayrollByMonth(month);
  if (existing && existing.status === 'finalized') {
    return res.status(422).json({ error: `Payroll for ${month} is already finalized and locked.` });
  }

  const employees = db.getEmployees().filter(e => e.status === 'active');
  const items = employees.map(emp => {
    const monthlyTax = calculateMonthlyTax(emp.grossSalary);
    const netSalary = emp.grossSalary - monthlyTax;
    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      department: emp.department,
      basicSalary: emp.basicSalary,
      grossSalary: emp.grossSalary,
      workingDaysInMonth: 22,
      presentDays: 22,
      absentDays: 0,
      halfDays: 0,
      unpaidLeaves: 0,
      absentDeduction: 0,
      halfDayDeduction: 0,
      unpaidLeaveDeduction: 0,
      totalDeductions: 0,
      taxableSalary: emp.grossSalary,
      monthlyTax,
      netSalary
    };
  });

  const totalGross = items.reduce((acc, i) => acc + i.grossSalary, 0);
  const totalTax = items.reduce((acc, i) => acc + i.monthlyTax, 0);
  const totalNet = items.reduce((acc, i) => acc + i.netSalary, 0);

  const record: any = {
    id: `PAY-${month}`,
    month,
    status: 'draft',
    items,
    totalGross,
    totalTax,
    totalDeductions: 0,
    totalNet,
    createdAt: new Date().toISOString()
  };

  db.addPayroll(record);
  res.status(201).json(record);
});

apiRouter.post('/payroll/:id/finalize', authenticateToken, requireRole('admin'), (req: Request, res: Response) => {
  const updated = db.updatePayroll(req.params.id, {
    status: 'finalized',
    finalizedAt: new Date().toISOString(),
    finalizedBy: req.user!.fullName
  });
  if (!updated) return res.status(404).json({ error: 'Payroll not found.' });
  res.json(updated);
});

// ==========================================
// 7. AUDIT LOGS (ADMIN ONLY)
// ==========================================

apiRouter.get('/audit', authenticateToken, requireRole('admin'), (_req: Request, res: Response) => {
  res.json(db.getAuditLogs());
});
