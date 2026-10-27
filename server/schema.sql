-- =====================================================================
-- SAYLANI HCM LITE - PRODUCTION DATABASE SCHEMA (POSTGRESQL / SQLITE)
-- =====================================================================

-- 0. OPERATIONAL DOCUMENT STORE (For Zero-Friction Cross-Instance Sync on Vercel)
CREATE TABLE IF NOT EXISTS hcm_store (
    key VARCHAR(64) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1. COMPANY CONFIGURATION & POLICIES
CREATE TABLE IF NOT EXISTS company_settings (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'primary',
    company_name VARCHAR(255) NOT NULL,
    timezone VARCHAR(64) DEFAULT 'Asia/Karachi',
    work_start_time VARCHAR(10) DEFAULT '09:00',
    work_end_time VARCHAR(10) DEFAULT '18:00',
    late_grace_minutes INT DEFAULT 15,
    half_day_min_hours DECIMAL(4, 2) DEFAULT 5.0,
    annual_leave_quota INT DEFAULT 14,
    sick_leave_quota INT DEFAULT 8,
    casual_leave_quota INT DEFAULT 10,
    weekends VARCHAR(32) DEFAULT '[0, 6]',
    biometric_policy_json JSONB DEFAULT '{}',
    is_setup BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS (AUTHENTICATION & RBAC)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'hr', 'employee')),
    full_name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(64) DEFAULT NULL,
    must_change_password BOOLEAN DEFAULT TRUE,
    activation_token VARCHAR(255) DEFAULT NULL,
    activation_token_expires TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_employee ON users(employee_id);

-- 3. EMPLOYEES & STATUS MANAGEMENT
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(64) PRIMARY KEY,
    employee_code VARCHAR(64) NOT NULL UNIQUE,
    user_id VARCHAR(64) UNIQUE,
    first_name VARCHAR(128) NOT NULL,
    last_name VARCHAR(128) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    department VARCHAR(128) NOT NULL,
    designation VARCHAR(128) NOT NULL,
    date_of_joining DATE NOT NULL,
    basic_salary DECIMAL(12, 2) NOT NULL,
    hra DECIMAL(12, 2) NOT NULL,
    medical_allowance DECIMAL(12, 2) NOT NULL,
    gross_salary DECIMAL(12, 2) NOT NULL,
    status VARCHAR(32) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    face_enrolled BOOLEAN DEFAULT FALSE,
    biometric_consent BOOLEAN DEFAULT FALSE,
    biometric_consent_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    deactivation_date DATE DEFAULT NULL,
    deactivation_reason TEXT DEFAULT NULL,
    final_working_date DATE DEFAULT NULL,
    termination_reason TEXT DEFAULT NULL,
    rehire_eligible BOOLEAN DEFAULT TRUE,
    reactivation_date DATE DEFAULT NULL,
    reactivation_reason TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- 4. ATTENDANCE RECORDS (SERVER-AUTHORITATIVE)
CREATE TABLE IF NOT EXISTS attendance (
    id VARCHAR(64) PRIMARY KEY,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id),
    date DATE NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    check_out_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('present', 'late', 'half_day', 'absent')),
    check_in_method VARCHAR(32) DEFAULT 'face_verified',
    check_out_method VARCHAR(32) DEFAULT 'face_verified',
    work_hours_minutes INT DEFAULT 0,
    is_late BOOLEAN DEFAULT FALSE,
    late_minutes INT DEFAULT 0,
    is_half_day BOOLEAN DEFAULT FALSE,
    missing_check_out BOOLEAN DEFAULT TRUE,
    notes TEXT DEFAULT NULL,
    verified_by VARCHAR(64) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_emp_date UNIQUE (employee_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

-- 5. FALLBACK ATTENDANCE REQUESTS
CREATE TABLE IF NOT EXISTS fallback_requests (
    id VARCHAR(64) PRIMARY KEY,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id),
    date DATE NOT NULL,
    action_type VARCHAR(16) NOT NULL CHECK (action_type IN ('check_in', 'check_out')),
    requested_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    reason VARCHAR(64) NOT NULL,
    reason_details TEXT NOT NULL,
    status VARCHAR(16) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by VARCHAR(255) DEFAULT NULL,
    review_notes TEXT DEFAULT NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fallback_status ON fallback_requests(status);

-- 6. LEAVE APPLICATIONS & RECORDS
CREATE TABLE IF NOT EXISTS leaves (
    id VARCHAR(64) PRIMARY KEY,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id),
    leave_type VARCHAR(32) NOT NULL CHECK (leave_type IN ('annual', 'sick', 'casual', 'unpaid')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    working_days INT NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(16) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by VARCHAR(255) DEFAULT NULL,
    approved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    comments TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_leaves_emp ON leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);

-- 7. PAYROLL RUNS & PAYSLIPS
CREATE TABLE IF NOT EXISTS payrolls (
    id VARCHAR(64) PRIMARY KEY,
    month VARCHAR(7) NOT NULL UNIQUE, -- YYYY-MM
    status VARCHAR(16) DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
    finalized_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    finalized_by VARCHAR(255) DEFAULT NULL,
    total_gross DECIMAL(14, 2) NOT NULL,
    total_tax DECIMAL(14, 2) NOT NULL,
    total_deductions DECIMAL(14, 2) NOT NULL,
    total_net DECIMAL(14, 2) NOT NULL,
    items JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. BIOMETRIC ENCRYPTED VAULT (AES-256-GCM)
CREATE TABLE IF NOT EXISTS biometric_templates (
    employee_id VARCHAR(64) PRIMARY KEY REFERENCES employees(id),
    algorithm VARCHAR(32) DEFAULT 'aes-256-gcm',
    iv VARCHAR(64) NOT NULL,
    auth_tag VARCHAR(64) NOT NULL,
    encrypted_data TEXT NOT NULL,
    quality_score INT DEFAULT 85,
    samples_count INT DEFAULT 3,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. IMMUTABLE SECURITY AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(64) DEFAULT NULL,
    user_email VARCHAR(255) DEFAULT NULL,
    user_role VARCHAR(32) DEFAULT NULL,
    action VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) DEFAULT NULL,
    details TEXT NOT NULL,
    ip_address VARCHAR(64) DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

-- 10. AI ASSISTANT QUERY LOGS
CREATE TABLE IF NOT EXISTS ai_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    user_role VARCHAR(32) NOT NULL,
    prompt TEXT NOT NULL,
    tool_calls JSONB DEFAULT NULL,
    response TEXT NOT NULL,
    duration_ms INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON ai_logs(user_id);
