# Saylani HCM Lite — Vercel Production Deployment Guide

This guide provides definitive, engineering-grade instructions for deploying and operating **Saylani HCM Lite** on Vercel's serverless platform.

---

## 1. Architecture Overview on Vercel

```
[ Client Browser (SPA) ]
          │
          ▼
[ Vercel Edge / CDN ]
   ├── Static Frontend Routes (/*) ──────────► /dist/index.html (Vite Single Page Application)
   └── API Serverless Routes (/api/*) ───────► /api/index.ts (Node.js 20+ Serverless Function)
                                                     │
                                                     ├──► [ Hosted PostgreSQL Database ] (Neon / Supabase / Vercel Postgres)
                                                     │         ├── hcm_store (Document Sync for Zero-Friction Lambdas)
                                                     │         └── Relational Tables (users, employees, attendance, leaves, etc.)
                                                     │
                                                     └──► [ Google Gemini Interactions API ] (gemini-3.8-flash)
```

---

## 2. Prerequisites

1. **GitHub / GitLab / Bitbucket Repository**: Push the `saylani-hcm-lite` repository to your Git provider.
2. **Vercel Account**: [https://vercel.com](https://vercel.com).
3. **Hosted PostgreSQL Database** (Required for reliable production persistence):
   - Recommended providers: **Neon** ([neon.tech](https://neon.tech)), **Supabase** ([supabase.com](https://supabase.com)), or **Vercel Postgres**.
   - Copy your connection string (`DATABASE_URL` / `POSTGRES_URL`).
4. **Google Gemini API Key**:
   - Obtain from [Google AI Studio](https://aistudio.google.com/app/apikey).

---

## 3. Step-by-Step Vercel Project Import

1. Log into your **Vercel Dashboard**.
2. Click **"Add New..."** ➔ **"Project"**.
3. Select your repository: `Owais-Shoukat/HCM_LITE` (or your personal fork).
4. In the **Configure Project** screen:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `vite build` (or leave default preset)
   - **Output Directory**: `dist` (preset default)
   - **Install Command**: `npm install`

---

## 4. Required Environment Variables

Configure the following environment variables in **Project Settings** ➔ **Environment Variables**:

| Variable Name | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Enforces production security optimizations |
| `JWT_SECRET` | **Yes** | `super-secret-hex-or-phrase-min-32-chars` | HMAC-SHA256 signing secret for session tokens |
| `BIOMETRICS_VAULT_KEY`| **Yes** | `32-byte-hex-string` (64 hex characters) | AES-256-GCM encryption key for facial vectors |
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@ep-xyz.neon.tech/saylani_hcm?sslmode=require` | Hosted PostgreSQL connection string for persistence |
| `GEMINI_API_KEY` | **Yes** | `AIzaSy...` | Google Gemini API key for intelligent HCM assistant |
| `GEMINI_MODEL` | Optional | `gemini-3.8-flash` | Gemini model name |
| `TIMEZONE` | Optional | `Asia/Karachi` | Authoritative organization timezone (PKT) |

> [!CAUTION]
> Never hardcode `JWT_SECRET` or `BIOMETRICS_VAULT_KEY` in git or frontend source. If `BIOMETRICS_VAULT_KEY` is rotated or lost, previously enrolled face biometric templates cannot be decrypted and will require re-enrollment.

---

## 5. Production Database Configuration & Safe Migration

### Step A: Initialize PostgreSQL Database

Before or immediately after the initial deployment, run the automated migration script to initialize schema tables and sync any existing records:

```bash
# From your local terminal or CI/CD pipeline:
DATABASE_URL="your-production-postgres-connection-string" npx tsx scripts/migrate_to_postgres.ts
```

This script:
1. Executes `server/schema.sql` (creating `hcm_store`, `company_settings`, `users`, `employees`, `attendance`, `leaves`, `payrolls`, `audit_logs`, and `biometric_templates`).
2. Syncs existing data from `data/hcm_data.json` and `data/biometrics.enc.json` into `hcm_store`.
3. Verifies data integrity with complete row counts.

### Step B: How Serverless Persistence Operates

- On Vercel, serverless lambdas are ephemeral and run with a read-only filesystem (except `/tmp`).
- When `DATABASE_URL` or `POSTGRES_URL` is set, `server/db.ts` automatically commits state changes to the PostgreSQL `hcm_store` table on every write.
- When concurrent lambdas spin up across regions, they synchronize against the shared PostgreSQL database.
- If no `DATABASE_URL` is provided during initial testing, `server/db.ts` gracefully routes writes to `/tmp/saylani-hcm-data`, preventing deployment crashes while warning the operator in logs.

---

## 6. Deployment Verification & Smoke Testing

Once deployment completes and Vercel assigns your production URL (e.g., `https://saylani-hcm-lite.vercel.app`):

### 1. Health & Setup Check
- Open `https://<your-app>.vercel.app/api/health`
  - Expected: `{"status":"healthy","timestamp":"..."}`
- Open `https://<your-app>.vercel.app/api/auth/setup-status`
  - Expected: `{"isSetup": false}` (on clean database) or `{"isSetup": true}` (if admin provisioned)

### 2. First-Run Master Admin Setup
- Navigate to `https://<your-app>.vercel.app/`
- If uninitialized, the **First-Run System Setup** modal will appear.
- Fill in:
  - **Full Name**: `Owais Shoukat` (or Master Administrator)
  - **Email**: `admin@saylaniwelfare.com`
  - **Password**: Minimum 8 characters
- Submit the form. The system will provision the Master Admin account and immediately transition to the authenticated dashboard.

### 3. Verify HR & Employee Management
- As Admin, navigate to **Employees** tab.
- Click **"Register New Employee"**:
  - Fill in Name, Department, Designation, Joining Date, and Basic Salary (e.g., 80,000 PKR).
  - Verify automatic calculation: Basic (80,000) + HRA (32,000) + Medical (8,000) = Gross Salary (120,000 PKR).
  - Save. An invitation token and activation link will be generated.
- Test the activation link in an incognito window: set permanent password and log in as the employee.

### 4. Verify Server-Authoritative Attendance & Facial Biometrics
- Log in as the Employee.
- Navigate to **Biometrics** tab: provide consent and capture face descriptor.
- Navigate to **Attendance** tab: test check-in before 09:15 PKT (marked Present) or after 09:15 PKT (marked Late with exact late minutes).
- Test duplicate check-in rejection: attempting another check-in returns HTTP 409 Conflict.

### 5. Verify Gemini AI Assistant
- Click the **"AI Assistant"** button in the top navigation header.
- Test quick prompts:
  - *"Mera leave balance kitna hai?"* (Personal leave balances returned in Urdu/English).
  - *"Mujhe kal chutti chahiye bukhar ki wajah se"* (Smart Leave NLP parser creates draft application).
  - Colleague privacy check: *"Mere colleague ki salary kitni hai?"* (Politely and strictly refused with `Access Denied`).

---

## 7. Common Deployment Issues & Troubleshooting

### Issue 1: `404 Not Found` on Page Refresh
- **Cause**: Client-side routing not rewritten to `index.html`.
- **Fix**: Verify `vercel.json` contains:
  ```json
  {
    "rewrites": [
      { "source": "/api/(.*)", "destination": "/api" },
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```

### Issue 2: `EROFS: read-only file system` Error
- **Cause**: Attempting to write JSON database files directly to the root filesystem on Vercel.
- **Fix**: This is resolved in `server/db.ts` via dynamic fallback to `/tmp` and PostgreSQL cloud sync (`DATABASE_URL`). Ensure `DATABASE_URL` is set in Vercel project environment variables.

### Issue 3: Inconsistent Data Between Requests
- **Cause**: Relying on `/tmp` on serverless functions across different lambda containers.
- **Fix**: Connect a hosted PostgreSQL database (`DATABASE_URL`) and run `npx tsx scripts/migrate_to_postgres.ts`.

### Issue 4: AI Assistant Returns 404/503
- **Cause**: Invalid or deprecated Gemini model.
- **Fix**: Verify `GEMINI_API_KEY` is set in Vercel environment variables. The system uses `gemini-3.8-flash` with automatic fallback to Pakistan policy rules and grounded local database tools.

---

## 8. Data Safety & Future Updates

1. **Database Snapshots**: Use your PostgreSQL provider's automated backup schedule (Neon/Supabase provide point-in-time recovery).
2. **Zero-Downtime Deployments**: Vercel automatically deploys updates to preview URLs first. You can run automated tests against preview URLs before promoting to production.
3. **No Accidental Data Wipes**: Test suites use isolated snapshots with automatic rollback (`db.rollback()`), guaranteeing tests never wipe or alter live production records.
