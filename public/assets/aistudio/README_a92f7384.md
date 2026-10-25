# Saylani HCM Lite
### Production-Quality, AI-Powered Human Capital Management System

Built for the **Saylani Hackathon HCM Lite Challenge**, strictly following the official `Saylani_Hackathon_HCM_Lite_Brief.pdf`.

---

## 🚀 Live Demo & Repository Quickstart

### Prerequisites
- Node.js 18+ or [Bun 1.2+](https://bun.sh)
- Python 3.10+ (for business-rule validation test suite)

### 1. Installation & Environment
```bash
# Clone repository
git clone https://github.com/your-org/saylani-hcm-lite.git
cd saylani-hcm-lite

# Install dependencies with Bun or npm
bun install
# Or: npm install

# Copy environment variables
cp .env.example .env
```

### 2. Run Tests
```bash
# A. Authoritative Python Business Rules Suite (24 unit tests)
npm test
# Or: python -m unittest backend/tests/test_rules.py

# B. TypeScript Type Check (0 errors)
npm run lint

# C. 31-Point End-to-End & Security Verification Suite
bun run test:e2e
# Or: bun scripts/e2e_verify.ts

# D. Isolated authentication/setup regression checks (does not use the real data directory)
npm run test:auth
```

The initial Admin setup form starts with blank name, email, and password fields; there are no default credentials. The end-to-end suite uses a database reset endpoint that is disabled by default. Run it only against a disposable test server configured with `NODE_ENV=test` and `HCM_ENABLE_TEST_RESET=true`; never enable that flag for a server containing real data.

### 3. Start Development Server
```bash
npm run dev
# Or: bun server.ts
# Server will be live at http://localhost:3000
```

### 4. Production Build & Start
```bash
npm run build
npm start
```

---

## 🏛️ Architecture Overview

Saylani HCM Lite is architected with strict separation of concerns, enterprise security boundaries, transactional durability, server-authoritative timestamps, and zero trust authorization:

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons, jsPDF.
- **Backend API:** Express REST API with security headers, CORS, rate limits, and server-side RBAC middleware (`server.ts`, `server/api.ts`).
- **Core Rules Engine:**
  - `backend/app/services/rules.py` with 24 passing unit tests in `backend/tests/test_rules.py`.
  - `server/rules.ts` TypeScript parity service ensuring business logic is unified across Python and Node.
- **Dual Persistence Architecture:**
  - **Primary SQLite Store:** High-performance, ACID-compliant SQLite (`data/hcm.sqlite`) with WAL mode (`PRAGMA journal_mode = WAL;`) and transactional rollbacks.
  - **Atomic JSON Store:** Dual-synced atomic JSON store (`data/hcm_data.json`) with temporary-file write + rename to prevent data corruption.
  - **PostgreSQL Ready:** Documented DDL schema in `server/schema.sql` with tables, indexes, unique constraints, and foreign keys.
- **AI Engine:** Google Gemini (`@google/genai` with `gemini-2.5-flash`), function calling/tools (`get_headcount`, `get_attendance_summary`, `get_late_comers`, `get_frequent_late_comers`, `get_leave_summary`, `get_my_leave_balance`, `get_payroll_summary`, `search_employees`), Smart Leave NLP parsing, and Roman Urdu language comprehension with sensitive colleague salary refusal.

---

## 📋 The 25 Required Functionalities Across 9 Modules

| # | Module | Feature | Status | Notes |
|---|---|---|---|---|
| 1 | Auth & Access | First-run setup & Initial Admin | **Verified** | Prevents duplicate initial Admin creation (HTTP 400) |
| 2 | Auth & Access | Multi-Role Authentication | **Verified** | Admin, HR, and Employee JWT tokens |
| 3 | Auth & Access | Temporary Passwords | **Verified** | Enforced change password modal on 1st login |
| 4 | Organization | Company Profile & Hours | **Verified** | 09:00 start, 18:00 end, weekends config |
| 5 | Organization | Geofencing & Coordinates | **Verified** | Office lat/long & perimeter check |
| 6 | Organization | Departments & Designations | **Verified** | Dynamic hierarchy management |
| 7 | Organization | Public Holidays & Quotas | **Verified** | Annual (14), Sick (8), Casual (10), Unpaid |
| 8 | Employee Mgmt | Employee Registration | **Verified** | Auto-generates user account & temporary password |
| 9 | Employee Mgmt | Employee Directory | **Verified** | Search, filter, pagination, details (salaries masked for employees) |
| 10 | Employee Mgmt | CSV Import with Dry-Run | **Verified** | Validates row, field, & reason before commit |
| 11 | Employee Mgmt | CSV Data Export | **Verified** | 1-click CSV dump with salary structure |
| 12 | Attendance | Web-based Check-In/Out | **Verified** | Server-generated timestamps only |
| 13 | Attendance | Attendance Status Logic | **Verified** | Late after 09:15, Half-day &lt; 5 hours |
| 14 | Attendance | Duplicate Check-in Block | **Verified** | Returns HTTP 409 Conflict |
| 15 | Attendance | Daily Attendance Board | **Verified** | Live roster for HR and Admin |
| 16 | Attendance | Attendance Corrections | **Verified** | Employee request & HR review audit trail |
| 17 | Attendance | Camera & Face Punch | **Verified** | Optional webcam preview & geofence |
| 18 | Leave Mgmt | Leave Application | **Verified** | Excludes weekends & public holidays |
| 19 | Leave Mgmt | Overlap & Quota Checks | **Verified** | Returns HTTP 422 on conflict or insufficient balance |
| 20 | Leave Mgmt | Approval Workflow | **Verified** | HR decision with comments & notifications |
| 21 | Payroll Lite | Salary Structure Engine | **Verified** | HRA 40%, Medical 10%, Gross 1.5x Basic |
| 22 | Payroll Lite | Deductions & Proration | **Verified** | Absent days, unpaid leaves, half-days, joiner proration |
| 23 | Payroll Lite | 5 Progressive Tax Slabs | **Verified** | Exact annualized slabs / 12 monthly tax |
| 24 | Payroll Lite | Admin Finalization Lock | **Verified** | Finalized payroll is locked and immutable (HTTP 422 on re-gen) |
| 25 | Communications | Communications & AI | **Verified** | In-app alerts, audit log, Roman Urdu AI, colleague salary privacy |

---

## 🔒 Security & Role-Based Access Control (RBAC)

Every endpoint enforces strict server-side verification:

- **Admin:** Manages company profile, departments, designations, public holidays, user accounts, immutable audit logs, company analytics, and finalizes payroll.
- **HR:** Registers employees, assigns salary structures, approves leaves, corrects attendance, generates monthly payroll drafts, and broadcasts announcements. *(Forbidden from finalizing payroll, creating admin users, viewing audit logs, or modifying protected company settings)*.
- **Employee:** Scoped strictly to their own employee ID. Can check in/out, view own attendance calendar, apply for leaves, and download personal payslips. *(Attempting to view colleague salaries, payslips, or profiles returns HTTP 403 Forbidden)*.

---

## 🧮 Official Payroll & Tax Formulas

### 1. Gross Salary Formula
- **HRA:** 40% of Basic Salary
- **Medical Allowance:** 10% of Basic Salary
- **Gross Salary:** 1.5 × Basic Salary (Basic + HRA + Medical)
- **Daily Salary:** Gross Salary ÷ Applicable Working Days in Month

### 2. Deductions
- **Absent Days:** Absent Days × Daily Salary
- **Unpaid Leave:** Unpaid Days × Daily Salary
- **Half-Days:** Half-Days × 0.5 × Daily Salary
- **Joiner/Leaver Proration:** Prorated by active working days if joined mid-month

### 3. Annual Tax Slabs
- **Up to 600,000:** 0%
- **600,001 – 1,200,000:** 5% on excess over 600,000
- **1,200,001 – 2,400,000:** 30,000 + 15% on excess over 1,200,000
- **2,400,001 – 3,600,000:** 210,000 + 25% on excess over 2,400,000
- **Above 3,600,000:** 510,000 + 35% on excess over 3,600,000
- **Monthly Tax:** Annual Tax ÷ 12

---

## 🧪 Testing Results

### 1. Python Business Rules Test Suite (`test_rules.py`)
```bash
python -m unittest backend/tests/test_rules.py
........................
----------------------------------------------------------------------
Ran 24 tests in 0.012s
OK
```

### 2. 31-Point End-to-End & Security Verification (`e2e_verify.ts`)
```bash
bun scripts/e2e_verify.ts
--- Starting Saylani HCM Lite Comprehensive E2E & Security Verification ---
[1] Health Check: Status 200 (healthy)
[2] Setup Status: isSetup = false
[3] First-Run Setup: Status 201 (Admin account created)
[4] Prevent unauthorized 2nd Admin: Status 400 (Expected 400)
[5] Admin Created HR User: Status 201
[6] HR Logged In: Status 200 (mustChangePassword=true)
[7] HR Registered Employee 1: Status 201 (Gross Salary PKR 150000)
[7b] HR Registered Employee 2: Status 201 (Gross Salary PKR 120000)
[8] Employee 1 Logged in: mustChangePassword=true
[9] Employee 1 Changed Password: Status 200
[10] Employee 1 Check-In: Status 201 (Missing Checkout)
[11] Duplicate Check-In Attempt: Status 409 (Expected 409 Conflict)
[12] Employee 1 Leave Application: Status 201 (2 working days)
[13] HR Approved Leave: Status 200 (Approved)
[14] HR Generated Payroll Draft: Status 201 (Total Net: PKR 0)
[15] Admin Finalized Payroll Run: Status 200 (finalized)
[16] Finalized Payroll Lock Check: Status 422 (Expected 422 Unprocessable)
[17] Employee 1 Accesses Own Payslip: Status 200 (Net: PKR 0)
[18] Data Isolation Privacy Check (Colleague Salary Access): Status 403 (Expected 403 Forbidden)
[19] Admin Reviewed Audit Trail: Status 200 (10 audit records logged)
[20] RBAC Check (HR Audit Logs Access): Status 403 (Expected 403 Forbidden)
[21] RBAC Check (HR Finalize Payroll): Status 403 (Expected 403 Forbidden)
[22] RBAC Check (HR Change Company Settings): Status 403 (Expected 403 Forbidden)
[23] RBAC Check (HR Create Admin): Status 403 (Expected 403 Forbidden)
[24] Data Isolation (Employee view colleague profile): Status 403 (Expected 403 Forbidden)
[25] Data Isolation (Employee view colleague leave balances): Status 403 (Expected 403 Forbidden)
[26] AI Privacy Test (Colleague Salary Query): Status 200
     AI Response: "Access Denied: You are not authorized to view another employee's salary or confidential financial records."
[27] AI Active Leaves Query: Status 200
     AI Response: "Aaj koi employee leave par nahi hai (0 employees currently on leave today)."
[28] AI Frequent Late Comers Query: Status 200
     AI Response: "Is mahine koi bhi employee late nahi aaya (No late arrivals recorded this month yet)."
[29] AI Sick Leave Balance Query: Status 200
     AI Response: "Aap ki **8** sick leaves baqi hain (Annual Quota: 8, Used: 0)."
[30] AI Smart Leave NLP Parsing: Status 200
     Smart Leave Action: {
  leaveType: "casual",
  startDate: "2026-10-26",
  endDate: "2026-10-27",
  reason: "Mujhe next Monday aur Tuesday ki casual leave chahiye.",
  workingDays: 2,
}
[31] AI Headcount Query: Status 200
     AI Response: "Current active employee headcount across the company is 2."
================================================================
✅ ALL 31 ADVANCED E2E, SECURITY & AI VERIFICATIONS PASSED 100%!
================================================================
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env`:
- `GEMINI_API_KEY`: Google Gemini API key for tool calling & Roman Urdu Q&A.
- `JWT_SECRET`: Cryptographically strong secret key for JWT signing.
- `PORT`: Port to run the application (defaults to 3000).
- `APP_URL`: Public application URL for production deployment.
- `DATABASE_URL`: Optional PostgreSQL connection string (defaults to local SQLite + atomic JSON store).

---

## 📄 License
Licensed under Apache 2.0. Built for Saylani Welfare International Trust Hackathon.
