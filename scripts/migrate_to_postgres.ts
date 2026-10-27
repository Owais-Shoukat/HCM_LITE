/**
 * Saylani HCM Lite - Production PostgreSQL Migration Script
 * Migrates local JSON persistence (data/hcm_data.json and data/biometrics.enc.json)
 * to a hosted PostgreSQL database (Neon, Supabase, Vercel Postgres, Render, Railway).
 * 
 * Usage:
 *   DATABASE_URL="postgres://user:pass@host/db" npx tsx scripts/migrate_to_postgres.ts
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import type { DatabaseSchema, EncryptedBiometricTemplate } from '../server/types.ts';

dotenv.config();

const { Pool } = pg;

async function migrate() {
  console.log('================================================================');
  console.log('🚀 Saylani HCM Lite - PostgreSQL Database Migration');
  console.log('================================================================\n');

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    console.error('❌ ERROR: Missing DATABASE_URL or POSTGRES_URL environment variable.');
    console.error('Please configure your database connection string and try again.');
    console.error('Example: DATABASE_URL="postgresql://user:pass@ep-xyz.neon.tech/saylani_hcm" npx tsx scripts/migrate_to_postgres.ts');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  console.log('✅ Connected to target PostgreSQL database successfully.');

  try {
    // 1. Run DDL Schema from server/schema.sql
    const schemaPath = path.resolve(process.cwd(), 'server', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('📄 Executing DDL schema from server/schema.sql...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      await client.query(schemaSql);
      console.log('✅ Relational schema tables & indexes ensured.');
    } else {
      console.warn('⚠️ Warning: server/schema.sql not found, ensuring hcm_store table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS hcm_store (
          key VARCHAR(64) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }

    // 2. Read local data files
    const dataDir = path.resolve(process.cwd(), 'data');
    const mainFile = path.join(dataDir, 'hcm_data.json');
    const bioFile = path.join(dataDir, 'biometrics.enc.json');

    let mainData: DatabaseSchema | null = null;
    let bioData: { templates: EncryptedBiometricTemplate[] } = { templates: [] };

    if (fs.existsSync(mainFile)) {
      mainData = JSON.parse(fs.readFileSync(mainFile, 'utf-8'));
      console.log(`📦 Loaded local hcm_data.json (${mainData?.users?.length || 0} users, ${mainData?.employees?.length || 0} employees)`);
    } else {
      console.log('ℹ️ No local data/hcm_data.json found. Creating clean initialization.');
    }

    if (fs.existsSync(bioFile)) {
      bioData = JSON.parse(fs.readFileSync(bioFile, 'utf-8'));
      console.log(`🔐 Loaded local biometrics.enc.json (${bioData.templates.length} templates)`);
    }

    // 3. Upsert into document store (hcm_store) for zero-friction serverless persistence
    if (mainData) {
      await client.query(
        `INSERT INTO hcm_store (key, data, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = NOW();`,
        ['main', JSON.stringify(mainData)]
      );
      console.log('✅ Synchronized main operational state to hcm_store table.');
    }

    await client.query(
      `INSERT INTO hcm_store (key, data, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = NOW();`,
      ['biometrics', JSON.stringify(bioData)]
    );
    console.log('✅ Synchronized biometric vault state to hcm_store table.');

    // 4. Populate relational tables if data exists
    if (mainData) {
      console.log('📊 Populating relational tables...');

      // Company Settings
      if (mainData.settings) {
        const s = mainData.settings;
        await client.query(`
          INSERT INTO company_settings (
            id, company_name, timezone, work_start_time, work_end_time,
            late_grace_minutes, half_day_min_hours, annual_leave_quota,
            sick_leave_quota, casual_leave_quota, weekends, is_setup, updated_at
          ) VALUES (
            'primary', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
          ) ON CONFLICT (id) DO UPDATE SET
            company_name = $1, timezone = $2, work_start_time = $3, work_end_time = $4,
            late_grace_minutes = $5, half_day_min_hours = $6, annual_leave_quota = $7,
            sick_leave_quota = $8, casual_leave_quota = $9, weekends = $10, is_setup = $11,
            updated_at = NOW();
        `, [
          s.companyName, s.timezone, s.workStartTime, s.workEndTime,
          s.lateGraceMinutes, s.halfDayMinHours, s.leaveQuotas.annual,
          s.leaveQuotas.sick, s.leaveQuotas.casual, JSON.stringify(s.weekends),
          mainData.isSetup
        ]);
      }

      // Users
      for (const u of mainData.users || []) {
        await client.query(`
          INSERT INTO users (
            id, email, password_hash, role, full_name, employee_id,
            must_change_password, activation_token, activation_token_expires,
            is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            email = $2, role = $4, full_name = $5, employee_id = $6,
            must_change_password = $7, is_active = $10, updated_at = NOW();
        `, [
          u.id, u.email, u.passwordHash, u.role, u.fullName, u.employeeId || null,
          u.mustChangePassword, u.activationToken || null, u.activationTokenExpires || null,
          u.isActive, u.createdAt, u.updatedAt
        ]);
      }

      // Employees
      for (const e of mainData.employees || []) {
        await client.query(`
          INSERT INTO employees (
            id, employee_code, user_id, first_name, last_name, email,
            department, designation, date_of_joining, basic_salary, hra,
            medical_allowance, gross_salary, status, face_enrolled,
            biometric_consent, deactivation_date, deactivation_reason,
            final_working_date, termination_reason, rehire_eligible,
            reactivation_date, reactivation_reason, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
          ON CONFLICT (id) DO UPDATE SET
            status = $14, face_enrolled = $15, basic_salary = $10,
            gross_salary = $13, updated_at = NOW();
        `, [
          e.id, e.employeeCode, e.userId || null, e.firstName, e.lastName, e.email,
          e.department, e.designation, e.dateOfJoining, e.basicSalary, e.hra,
          e.medicalAllowance, e.grossSalary, e.status, e.faceEnrolled,
          e.biometricConsent, e.deactivationDate || null, e.deactivationReason || null,
          e.finalWorkingDate || null, e.terminationReason || null, e.rehireEligible ?? true,
          e.reactivationDate || null, e.reactivationReason || null, e.createdAt, e.updatedAt
        ]);
      }

      console.log(`✅ Relational rows migrated: ${mainData.users?.length || 0} users, ${mainData.employees?.length || 0} employees.`);
    }

    console.log('\n================================================================');
    console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('Your Saylani HCM Lite PostgreSQL database is ready for production.');
    console.log('================================================================\n');

  } catch (err: any) {
    console.error('❌ Migration failed with error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
