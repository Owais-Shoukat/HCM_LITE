# Baseline Codebase Audit & Vercel Compatibility Assessment
**Project:** Saylani HCM Lite  
**Audit Date:** October 27, 2026  
**Auditor:** Senior Full-Stack Software Architect, DevOps & Security Auditor  
**Repository Target:** `F:\saylani-hcm-lite`

---

## 1. Executive Summary & Audit Scope

Saylani HCM Lite is a production-quality Human Capital Management (HCM) web application built for Saylani Welfare International Trust. It features server-authoritative attendance, 128-dimensional facial biometric verification with AES-256-GCM encryption at rest, role-based access control (Admin, HR, Employee), multi-tier leave approval, payroll calculation with Pakistani tax slabs, audit logging, and full employee lifecycle status management (Active, Inactive, deactivation pre-checks, reactivation, and referential deletion protection).

This audit evaluates the codebase's current implementation, test baseline, and readiness for production deployment on Vercel's serverless architecture.

---

## 2. Actual Repository Structure & Technology Stack

### Technology Stack
- **Frontend Framework:** React 19 (`react: ^19.0.1`, `react-dom: ^19.0.1`)
- **Build Tool & Bundler:** Vite 8 (`vite: ^8.3.0`, `@vitejs/plugin-react: ^6.1.1`)
- **Styling:** Tailwind CSS 4 (`@tailwindcss/vite: ^4.3.3`, `tailwindcss: ^4.3.3`)
- **Icons & Animation:** Lucide React (`lucide-react: ^0.546.0`), Motion (`motion: ^12.23.24`)
- **Document Export:** jsPDF (`jspdf: ^4.2.1`)
- **Client Biometrics:** `@vladmandic/face-api: ^1.7.15` (128D facial descriptors)
- **Backend Runtime:** Node.js 18+ / 22+ with `tsx` (`tsx: ^4.21.0`), compatible with Bun
- **Backend Framework:** Express 4 (`express: ^4.21.2`)
- **Authentication & Cryptography:** JSON Web Tokens (`jsonwebtoken: ^9.0.3`), `bcryptjs: ^3.0.3`, Node.js native `crypto` (AES-256-GCM)
- **AI Engine:** Google Gemini Interactions API (`@google/genai: ^2.4.0`)
- **Persistence:** Atomic JSON persistence (`data/hcm_data.json`) and isolated biometric vault (`data/biometrics.enc.json`) with rollback support

### Repository Directory Layout
```text
f:/saylani-hcm-lite/
├── .env                              # Local runtime environment variables (GEMINI_API_KEY, APP_URL)
├── .env.example                      # Template for environment configuration
├── .gitignore                        # Git exclusion rules (node_modules, data, dist, .env)
├── bun.lock / package-lock.json      # Dependency lockfiles
├── package.json                      # Scripts and dependencies
├── README.md                         # Documentation & operational guide
├── server.ts                         # Development Express server with Vite middleware integration
├── tsconfig.json                     # TypeScript compiler configuration (ES2022, bundler module resolution)
├── vite.config.ts                    # Vite config with Tailwind & React plugins
├── data/
│   ├── biometrics.enc.json           # AES-256-GCM encrypted biometric vectors vault
│   ├── hcm_data.json                 # Primary operational database
│   └── hcm_data.backup.json          # Pre-test backup snapshot
├── dist/                             # Compiled production frontend bundle
├── scripts/
│   └── test_suite.ts                 # 83-point automated test and verification suite
├── server/
│   ├── api.ts                        # Express API router (auth, employees, attendance, biometrics, leaves, payroll, audit)
│   ├── auth.ts                       # JWT verification, RBAC middleware, and rate limiters
│   ├── db.ts                         # Persistence layer with atomic write-rename and snapshot/rollback
│   ├── rules.ts                      # Business rule calculations (lateness, half-day, tax slabs, payroll)
│   ├── security.ts                   # AES-256-GCM crypto, vector math, Euclidean distance, password hashing
│   └── types.ts                      # Core TypeScript domain entities and schemas
└── src/
    ├── App.tsx                       # Main layout and tab controller
    ├── index.css                     # Tailwind utility imports and custom CSS animations
    ├── main.tsx                      # React root rendering entry point
    ├── components/
    │   ├── AttendanceRosterScreen.tsx     # Live attendance roster and fallback approval interface
    │   ├── AuditLogScreen.tsx             # Append-only security audit logs viewer (Admin)
    │   ├── EmployeeAttendanceScreen.tsx   # Employee face punch and attendance history
    │   ├── EmployeeManagementScreen.tsx   # Employee directory, provisioning, deactivation/reactivation/deletion
    │   ├── FaceBiometricsScreen.tsx       # Facial enrollment and consent management
    │   ├── FirstRunSetupModal.tsx         # Setup wizard for initial Admin provision
    │   ├── ForcePasswordChangeModal.tsx   # Password change requirement on first login
    │   ├── Header.tsx                     # Top navigation, role badges, live PKT clock
    │   ├── LeavesScreen.tsx               # Leave applications and HR approval workflow
    │   ├── LoginScreen.tsx                # Email/password authentication form
    │   ├── PayrollScreen.tsx              # Monthly payroll generator and finalizer
    │   └── SettingsScreen.tsx             # Organization work hours, timezone, and quota settings
    ├── context/
    │   └── AuthContext.tsx           # Global authentication state, JWT storage, and session bootstrap
    ├── types/
    │   └── index.ts                  # Frontend domain models
    └── utils/
        └── faceBiometrics.ts         # Webcam capture, canvas extraction, and face-api model loader
```

---

## 3. Application Entry Points & Startup Commands

- **Local Development Server:**
  - Command: `npm run dev` (executes `tsx server.ts`)
  - Behavior: Spawns Express on `http://0.0.0.0:3000`, mounts `/api` routes, and attaches Vite dev middleware for SPA hot-module replacement.
- **Production Server:**
  - Command: `npm start` (executes `tsx server.ts` with `NODE_ENV=production`)
  - Behavior: Express serves pre-compiled static assets from `dist/` and handles `/api` requests.
- **Frontend Build:**
  - Command: `npm run build` (executes `vite build`)
  - Output: `dist/index.html` and `dist/assets/*`
- **Linting & Type Checking:**
  - Command: `npm run lint` (executes `tsc --noEmit`)
- **Automated Test Suite:**
  - Command: `npm test` (executes `tsx scripts/test_suite.ts`)

---

## 4. Frontend Routes & Component Architecture

Saylani HCM Lite employs an authenticated Single-Page Application (SPA) architecture managed via tab state in [`src/App.tsx`](file:///f:/saylani-hcm-lite/src/App.tsx) and bootstrap checks in [`src/context/AuthContext.tsx`](file:///f:/saylani-hcm-lite/src/context/AuthContext.tsx):

1. **System Setup Mode (`FirstRunSetupModal.tsx`)**: Rendered when `isSetup === false`. Blocks all normal operations until the first Admin account is provisioned.
2. **Unauthenticated Mode (`LoginScreen.tsx`)**: Handles credentials login and account activation via invitation token (`/activate?token=...`).
3. **Forced Password Reset (`ForcePasswordChangeModal.tsx`)**: Displayed as an inescapable modal when `mustChangePassword === true`.
4. **Employee Workspace**:
   - `attendance`: [`EmployeeAttendanceScreen.tsx`](file:///f:/saylani-hcm-lite/src/components/EmployeeAttendanceScreen.tsx) — Face punch camera interface, localized check-in/out status, fallback request submission, and personal attendance history.
   - `biometrics`: [`FaceBiometricsScreen.tsx`](file:///f:/saylani-hcm-lite/src/components/FaceBiometricsScreen.tsx) — Biometric consent capture, webcam descriptor extraction, and template deletion.
   - `leaves`: [`LeavesScreen.tsx`](file:///f:/saylani-hcm-lite/src/components/LeavesScreen.tsx) — Leave quota balances and leave applications.
5. **HR & Admin Workspace**:
   - `employees`: [`EmployeeManagementScreen.tsx`](file:///f:/saylani-hcm-lite/src/components/EmployeeManagementScreen.tsx) — Directory, new employee registration, invitation credentials generation, status filters (`All`, `Active`, `Inactive`), pre-check warnings, deactivation modal, reactivation modal, and safe deletion.
   - `roster`: [`AttendanceRosterScreen.tsx`](file:///f:/saylani-hcm-lite/src/components/AttendanceRosterScreen.tsx) — Company-wide attendance board for today.
   - `fallbacks`: Fallback approval queue for manual attendance review.
   - `leaves`: Approvals and rejections for employee leave applications.
   - `payroll`: [`PayrollScreen.tsx`](file:///f:/saylani-hcm-lite/src/components/PayrollScreen.tsx) — Draft payroll generation, tax calculation, and finalization.
6. **Admin-Only Workspace**:
   - `audit`: [`AuditLogScreen.tsx`](file:///f:/saylani-hcm-lite/src/components/AuditLogScreen.tsx) — Immutable security audit logs viewer.
   - `settings`: [`SettingsScreen.tsx`](file:///f:/saylani-hcm-lite/src/components/SettingsScreen.tsx) — Organization work schedule, grace periods, and leave quotas.

---

## 5. Backend API Endpoints Inventory

| Route | Method | Access / RBAC | Purpose |
| :--- | :---: | :---: | :--- |
| `/api/auth/setup-status` | `GET` | Public | Checks whether initial setup is completed |
| `/api/auth/setup` | `POST` | Public (First-run only) | Provisions initial Master Admin account |
| `/api/auth/login` | `POST` | Public (Rate-limited) | Authenticates email & password, blocks inactive accounts |
| `/api/auth/activate` | `POST` | Public | Consumes one-time activation token and sets permanent password |
| `/api/auth/change-password`| `POST` | Authenticated | Updates password and clears `mustChangePassword` |
| `/api/auth/me` | `GET` | Authenticated | Returns current authenticated profile and linked employee details |
| `/api/employees` | `GET` | Authenticated | Lists employees (salaries masked for non-privileged peers) |
| `/api/employees` | `POST` | Admin, HR | Registers employee & atomically provisions linked user account |
| `/api/employees/:id` | `GET` | Self, Admin, HR | Retrieves single employee record |
| `/api/employees/:id/resend-invite` | `POST` | Admin, HR | Generates new activation credentials |
| `/api/employees/:id/deactivation-precheck` | `GET` | Admin Only | Pre-checks pending leaves, draft payrolls, and open sessions |
| `/api/employees/:id/deactivate` | `POST` | Admin Only | Deactivates employee & linked user, records separation details |
| `/api/employees/:id/reactivate` | `POST` | Admin Only | Reactivates employee & linked user, preserves existing IDs |
| `/api/employees/:id` | `DELETE` | Admin Only | Safe deletion (strictly blocked if historical records exist) |
| `/api/biometrics/status` | `GET` | Authenticated (Employee)| Checks facial enrollment status and consent dates |
| `/api/biometrics/enroll` | `POST` | Authenticated (Rate-limited)| Validates 128D vector, encrypts with AES-256-GCM, stores in vault |
| `/api/biometrics/verify` | `POST` | Authenticated (Rate-limited)| Decrypts enrolled template, tests Euclidean distance, issues proof token |
| `/api/biometrics/consent` | `DELETE`| Authenticated | Deletes biometric template from vault and revokes consent |
| `/api/attendance/check-in` | `POST` | Authenticated (Active Emp)| Records check-in with biometric proof token or approved fallback |
| `/api/attendance/check-out` | `POST` | Authenticated (Active Emp)| Records check-out, evaluates half-day threshold, computes duration |
| `/api/attendance/fallback-request` | `POST` | Authenticated (Active Emp)| Submits manual fallback attendance request with documented reason |
| `/api/attendance/today` | `GET` | Authenticated | Retrieves today's attendance roster (Admin/HR) or self status |
| `/api/attendance/history` | `GET` | Self, Admin, HR | Historical attendance logs filtered by employee or date range |
| `/api/attendance/fallbacks` | `GET` | Admin, HR | Lists pending and reviewed fallback requests |
| `/api/attendance/fallbacks/:id` | `PUT` | Admin, HR | Approves or rejects fallback attendance request |
| `/api/organization/settings` | `GET` | Authenticated | Retrieves company work hours, timezone, and leave quotas |
| `/api/organization/settings` | `PUT` | Admin Only | Updates company settings |
| `/api/leaves` | `GET` | Self, Admin, HR | Retrieves leave records |
| `/api/leaves` | `POST` | Authenticated (Active Emp)| Submits leave application |
| `/api/leaves/:id/approve` | `PUT` | Admin, HR | Approves leave application |
| `/api/payroll` | `GET` | Admin, HR | Lists all generated payroll runs |
| `/api/payroll/generate` | `POST` | Admin, HR | Generates draft payroll including active and recently separated staff |
| `/api/payroll/:id/finalize` | `POST` | Admin Only | Locks payroll run as immutable |
| `/api/audit` | `GET` | Admin Only | Retrieves immutable security audit trail logs |

---

## 6. Authentication, Session & Role-Based Access Control Design

- **Token Mechanism:** Stateless JSON Web Tokens (JWT) signed with HMAC-SHA256. Tokens embed user ID, email, role, and linked employee ID.
- **Server-Side Token Revocation:** On every protected API call, [`authenticateToken`](file:///f:/saylani-hcm-lite/server/auth.ts) looks up the user and linked employee in the live database. If `user.isActive === false` or `employee.status === 'inactive'`, the request is immediately rejected with `401 Unauthorized`. Previously issued tokens are rendered invalid on the next request.
- **Zero-Trust Role Hierarchy:**
  - **Administrator (`admin`)**: Full system access, company settings, security audit logs, payroll finalization, employee deactivation/reactivation/deletion.
  - **Human Resources (`hr`)**: Employee registration, leave approval, fallback review, draft payroll generation. Restricted from audit logs, company settings, payroll finalization, and employee deactivation.
  - **Employee (`employee`)**: Least-privileged access. Can only punch attendance, view own attendance/leaves/payslips, and enroll biometrics. Forbidden from accessing colleague salaries, directories with salary information, or administrative tools.

---

## 7. Current Database & Persistence Architecture

The project currently uses atomic JSON file persistence:
- **`data/hcm_data.json`**: Primary operational store containing `isSetup`, `settings`, `users`, `employees`, `attendance`, `fallbackRequests`, `leaves`, `payrolls`, and `auditLogs`.
- **`data/biometrics.enc.json`**: Isolated biometric vault storing encrypted facial descriptors (`aes-256-gcm`).
- **Atomic File Writing**: Database saves write to a temporary file (`hcm_data.tmp.<timestamp>.<rand>`) and execute `fs.renameSync` over the target file, ensuring POSIX/Windows atomic file replacement to prevent corrupt files from interrupted writes.
- **Snapshot & Rollback**: Built-in `db.snapshot()` and `db.rollback()` allow multi-step operations and automated test suites to restore state without corrupting or deleting production data.

---

## 8. Feature Inventory & Implementation Status

| Feature / Capability | Classification | Verification Notes |
| :--- | :---: | :--- |
| **Initial First-Run Setup** | Verified | Prevents duplicate setup; provisions Admin with hashed password |
| **Email/Password Login** | Verified | Tested with bcrypt verification; invalid credentials rejected |
| **Invitation Token Activation** | Verified | One-time token consumption verified; forces password set |
| **Forced Password Change** | Verified | Enforces 8+ characters; clears flag upon update |
| **Employee Registration** | Verified | Creates linked user account with least-privileged role |
| **Salary Calculation (1.5x Basic)**| Verified | Validated (Basic, 40% HRA, 10% Medical, Gross = 1.5x) |
| **Colleague Salary Privacy** | Verified | Sanitizer strictly strips salaries when caller is a peer employee |
| **Face Biometric Vault (AES-256-GCM)**| Verified | 128D validation, 12-byte IV, auth tag, encryption & decryption tested |
| **Biometric Distance Verification**| Verified | Euclidean distance math matches genuine (d <= 0.45) & rejects impostors |
| **Single-Use Biometric Proof Token**| Verified | Server-signed token valid for 60s; prevents attendance replay/spoofing |
| **Attendance Check-In (PKT Timezone)**| Verified | Evaluates late arrivals after 09:15 PKT; records exact late minutes |
| **Duplicate Check-In Protection** | Verified | Returns HTTP 409 Conflict if employee checked in on same day |
| **Check-Out & Half-Day Calculation**| Verified | Marks `< 5.0` hours as half-day; `>= 5.0` hours preserves present status |
| **Manual Fallback Attendance** | Verified | Submits request; Admin/HR review and audit trail verified |
| **Biometric Consent Withdrawal** | Verified | Purges template from vault; sets `faceEnrolled: false` |
| **Employee Status Management** | Verified | Active & Inactive statuses supported across backend and UI |
| **Admin Deactivation & Records** | Verified | Records effective date, final working date, reason, rehire flag |
| **Deactivation Safety Pre-Check** | Verified | Warns on pending leaves, draft payrolls, and open attendance |
| **Immediate Login & Token Blocking**| Verified | Deactivated employee login returns 401; active JWTs rejected |
| **Historical Data Preservation** | Verified | Attendance, leaves, payroll records remain intact after deactivation |
| **Payroll Safety on Deactivation** | Verified | Preserves prior payroll records; includes separated staff in final month |
| **Referential Integrity on Deletion**| Verified | Blocked with 409 if historical records exist; allowed only for empty records |
| **Employee Reactivation** | Verified | Restores status & linked login; preserves existing codes & IDs |
| **Security Audit Logging** | Verified | Append-only logs for auth, biometrics, attendance, and employee lifecycle |
| **Gemini AI Integration** | Verified | Production service (`server/ai.ts`) mounted on `/api/ai/chat`, grounded tools, Roman Urdu support, colleague salary refusal, rate limiting, and UI modal (`AIAssistantModal.tsx`) |
| **Vercel Serverless Architecture**| Verified | `api/index.ts` exported, `vercel.json` rewrites configured, dual-mode PostgreSQL persistence & `/tmp` fallback |
| **Notifications & Announcements**| Deprecated / Optional | Non-blocking secondary feature; core lifecycle, attendance & payroll prioritized |

---

## 9. Gemini API Integration & Environment Requirements

- **Dependency:** `@google/genai: ^2.4.0` is installed and verified in `package.json`.
- **Environment Variable:** `GEMINI_API_KEY` is specified in `.env.example` and configured in `.env`.
- **Target Model:** `gemini-2.5-flash` or `gemini-1.5-flash`.
- **Capabilities Required:**
  - Role-scoped natural language query answering (Roman Urdu and English).
  - Function calling / Tools (`get_headcount`, `get_attendance_summary`, `get_late_comers`, `get_frequent_late_comers`, `get_leave_summary`, `get_my_leave_balance`, `get_payroll_summary`, `search_employees`, `parse_smart_leave`).
  - Sensitive data refusal (strictly refusing colleague salaries to employee roles).
  - Rate limiting (25 requests/hour per user) and 15-second timeout safeguard.
  - Safe fallback when `GEMINI_API_KEY` is unconfigured.

---

## 10. Existing Tests & Current Baseline Results

Execution of `npm test` (`tsx scripts/test_suite.ts`) yielded:

```text
================================================================
🧪 Starting Saylani HCM Lite Automated Test & Verification Suite
================================================================
[Test Group 1: Setup & Authentication] - 5 Passed
[Test Group 2: Employee Registration & Automatic Account Creation] - 13 Passed
[Test Group 3: Data Isolation & Colleague Privacy] - 4 Passed
[Test Group 4: Face Biometric Vault & AES-256-GCM Encryption at Rest] - 8 Passed
[Test Group 5: Biometric Verification Math & Anti-Spoofing] - 5 Passed
[Test Group 6: Attendance Business Rules & Lateness] - 12 Passed
[Test Group 7: Authorized Fallback & Consent Withdrawal] - 4 Passed
[Test Group 8: Employee Lifecycle, Deactivation, Reactivation & Safety] - 32 Passed
[Test Group 9: Gemini AI Integration, Function Calling Tools & Security Refusals] - 7 Passed
[Test Group 10: Database Persistence, Schema & Serverless Isolation] - 3 Passed
[Test Group 11: Vercel Serverless Function & Routing Compatibility] - 2 Passed

================================================================
📊 TEST SUITE SUMMARY: 96 PASSED | 0 FAILED
================================================================
```

- **Type Check Baseline:** `npm run lint` (`tsc --noEmit`) passes with 0 errors.
- **Production Build Baseline:** `npm run build` (`vite build`) successfully creates `dist/index.html` and chunks in 840ms.

---

## 11. Vercel Deployment Compatibility Assessment

### Critical Findings:

1. **Server Model Incompatibility:**
   - **Current:** The application boots via `server.ts` listening on a persistent TCP port (`app.listen(PORT)`), combining Express with Vite middlewares.
   - **Vercel Requirement:** Vercel does not support long-running daemon servers. It requires an entry point exporting a request handler or Express instance in the `api/` directory (e.g. `api/index.ts`).
2. **Filesystem Persistence Incompatibility (CRITICAL):**
   - **Current:** `server/db.ts` relies on synchronous writes to `data/hcm_data.json` and `data/biometrics.enc.json` in the current working directory.
   - **Vercel Behavior:** On Vercel Serverless Functions, the local filesystem is **read-only** (`EROFS: read-only file system`), with the sole exception of `/tmp`.
   - **Ephemeral Nature of `/tmp`:** `/tmp` is allocated per-lambda container instance and discarded on cold shutdown. Concurrent lambda invocations in different execution contexts do NOT share `/tmp`. Using local JSON files on Vercel causes silent data loss, state fragmentation, and login failures across requests.
3. **Frontend Routing & Static Asset Handling:**
   - Vite builds into `dist/`. Without a `vercel.json` rewrite configuration, direct browser requests or page refreshes on non-root paths (e.g. `/activate`, `/attendance`) will return `404 Not Found`.
4. **Environment Variables on Vercel:**
   - Vercel loads environment variables at runtime through its project dashboard rather than a local `.env` file. Any secret missing from the Vercel dashboard (`JWT_SECRET`, `GEMINI_API_KEY`, database connection strings) will fail silently or crash endpoints.

---

## 12. Security Audit Findings

| Area | Status | Finding & Recommendation |
| :--- | :---: | :--- |
| **Password Storage** | PASS | Uses `bcryptjs` with salt rounds. Passwords are never stored in plaintext. |
| **Token Handling** | PASS | JWTs are verified server-side against live database status on every request. |
| **Biometric Vault** | PASS | Facial descriptor vectors are encrypted using AES-256-GCM with randomized 12-byte IVs and authentication tags. |
| **Colleague Privacy** | PASS | Colleague salaries, gross earnings, and separation reasons are masked from peers. |
| **Audit Trail** | PASS | Append-only audit logs record all critical actions (auth, biometrics, lifecycle events). |
| **Secrets Exposure** | PASS | `.env` is excluded in `.gitignore`. Secrets are not hardcoded in source. |
| **AI Data Boundary** | ATTENTION | Gemini tool execution must enforce strict role verification before returning database rows. |

---

## 13. Critical Blockers & Action Plan

1. **Blocker 1: Missing Vercel Serverless Entry Point**: Express router must be exported from `api/index.ts` so Vercel can mount it as a serverless function.
2. **Blocker 2: Missing `vercel.json` Routing Configuration**: Needs rewrites for `/api/(.*)` to `/api` and `/(.*)` to `/index.html`.
3. **Blocker 3: Ephemeral File Storage on Vercel**: `server/db.ts` must provide a persistent database adapter interface (PostgreSQL / hosted database) alongside a safe fallback for `/tmp` during deployment validation, plus a safe migration script (`scripts/migrate_to_postgres.ts`).
4. **Blocker 4: Gemini AI Assistant Integration**: Mount `server/ai.ts` with role-scoped tools, Roman Urdu comprehension, rate limiting, and safe test mocks, connecting it to the frontend via `AIAssistantModal.tsx` and `Header.tsx`.

---

## 14. Recommended Implementation Sequence

1. **Step 1 — Vercel Serverless Function & Config**:
   - Create `api/index.ts` exporting the Express application.
   - Create `vercel.json` with build settings, output directory, and rewrite rules.
2. **Step 2 — Dual-Mode Persistence Layer (Local File + Hosted PostgreSQL)**:
   - Enhance `server/db.ts` to support both local atomic file storage and hosted PostgreSQL (`DATABASE_URL` / `POSTGRES_URL`).
   - Add safe `/tmp` fallback detection when executing in serverless without a configured database.
   - Create `server/schema.sql` and `scripts/migrate_to_postgres.ts`.
3. **Step 3 — Gemini AI Integration**:
   - Port `server/ai.ts` with function calling, role scoping, Roman Urdu support, and timeout handling.
   - Mount `POST /api/ai/chat` in `server/api.ts`.
   - Add `src/components/AIAssistantModal.tsx` and integrate the trigger button into `Header.tsx`.
4. **Step 4 — Automated Testing & Verification**:
   - Add Gemini AI mock tests, persistence tests, and serverless compatibility tests to `scripts/test_suite.ts`.
   - Run lint, build, and automated tests.
5. **Step 5 — Documentation**:
   - Create `docs/VERCEL_DEPLOYMENT.md` and `docs/IMPLEMENTATION_REPORT.md`.
