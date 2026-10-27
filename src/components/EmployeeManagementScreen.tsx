import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Users,
  UserPlus,
  Mail,
  Building2,
  ScanFace,
  CheckCircle2,
  Clock,
  KeyRound,
  Copy,
  Check,
  Search,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Shield,
  ShieldAlert,
  UserX,
  UserCheck,
  Trash2,
  Info,
  Calendar,
  FileText,
  X
} from 'lucide-react';
import type { Employee } from '../types/index.ts';

export function EmployeeManagementScreen() {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Register Modal state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('IT & Software');
  const [designation, setDesignation] = useState('Software Engineer');
  const [basicSalary, setBasicSalary] = useState('80000');
  const [dateOfJoining, setDateOfJoining] = useState(new Date().toISOString().slice(0, 10));
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);

  // Success Dialog state (with copyable credentials)
  const [createdResult, setCreatedResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Deactivation Modal state
  const [deactivateModalEmp, setDeactivateModalEmp] = useState<Employee | null>(null);
  const [precheckLoading, setPrecheckLoading] = useState(false);
  const [precheckData, setPrecheckData] = useState<{
    hasWarnings: boolean;
    warnings: string[];
    pendingLeaves: any[];
    draftPayrolls: any[];
  } | null>(null);
  const [deactivateEffectiveDate, setDeactivateEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [deactivateReason, setDeactivateReason] = useState('Voluntary Resignation');
  const [customReasonDetails, setCustomReasonDetails] = useState('');
  const [finalWorkingDate, setFinalWorkingDate] = useState(new Date().toISOString().slice(0, 10));
  const [terminationCategory, setTerminationCategory] = useState('Voluntary resignation');
  const [rehireEligible, setRehireEligible] = useState(true);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  // Reactivation Modal state
  const [reactivateModalEmp, setReactivateModalEmp] = useState<Employee | null>(null);
  const [reactivateDate, setReactivateDate] = useState(new Date().toISOString().slice(0, 10));
  const [reactivateReason, setReactivateReason] = useState('');
  const [reactivateError, setReactivateError] = useState<string | null>(null);
  const [reactivateLoading, setReactivateLoading] = useState(false);

  // Deletion Modal state
  const [deleteModalEmp, setDeleteModalEmp] = useState<Employee | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBlockers, setDeleteBlockers] = useState<string[] | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Separation Details View Modal state
  const [viewDetailsEmp, setViewDetailsEmp] = useState<Employee | null>(null);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    setRegisterLoading(true);

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          department,
          designation,
          basicSalary: Number(basicSalary),
          dateOfJoining
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register employee.');
      }

      setShowRegisterModal(false);
      setCreatedResult(data);
      setFirstName('');
      setLastName('');
      setEmail('');
      setBasicSalary('80000');
      await fetchEmployees();
    } catch (err: any) {
      setRegisterError(err.message || 'Registration failed.');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdResult) return;
    const inv = createdResult.invitation;
    const text = `SAYLANI HCM LITE - EMPLOYEE ACTIVATION\n\nName: ${createdResult.employee.firstName} ${createdResult.employee.lastName}\nEmployee Code: ${createdResult.employee.employeeCode}\nWork Email: ${createdResult.employee.email}\nTemporary Password: ${inv.temporaryPassword}\n\nOne-Time Activation URL:\n${window.location.origin}/activate?token=${encodeURIComponent(inv.activationToken)}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleResendInvite = async (empId: string) => {
    try {
      const res = await fetch(`/api/employees/${empId}/resend-invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to refresh invitation.');
        return;
      }

      const employee = employees.find((e) => e.id === empId);
      if (!employee || !data.invitation?.activationToken) {
        alert('The invitation was created, but its activation details are missing.');
        return;
      }

      setCreatedResult({
        employee,
        invitation: data.invitation
      });
    } catch (err: any) {
      alert(err.message || 'Error resending invitation.');
    }
  };

  // Open Deactivation Modal & fetch pre-check warnings
  const openDeactivateModal = async (emp: Employee) => {
    setDeactivateModalEmp(emp);
    setDeactivateError(null);
    setPrecheckLoading(true);
    setPrecheckData(null);
    setDeactivateEffectiveDate(new Date().toISOString().slice(0, 10));
    setFinalWorkingDate(new Date().toISOString().slice(0, 10));
    setDeactivateReason('Voluntary Resignation');
    setCustomReasonDetails('');
    setTerminationCategory('Voluntary resignation');
    setRehireEligible(true);

    try {
      const res = await fetch(`/api/employees/${emp.id}/deactivation-precheck`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPrecheckData(data);
      }
    } catch (err) {
      console.error('Error fetching deactivation precheck:', err);
    } finally {
      setPrecheckLoading(false);
    }
  };

  const handleDeactivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deactivateModalEmp) return;
    setDeactivateLoading(true);
    setDeactivateError(null);

    const fullReason = customReasonDetails
      ? `${deactivateReason}: ${customReasonDetails}`
      : deactivateReason;

    try {
      const res = await fetch(`/api/employees/${deactivateModalEmp.id}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          effectiveDate: deactivateEffectiveDate,
          reason: fullReason,
          finalWorkingDate,
          terminationReason: terminationCategory,
          rehireEligible
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to deactivate employee.');
      }

      setDeactivateModalEmp(null);
      await fetchEmployees();
    } catch (err: any) {
      setDeactivateError(err.message || 'Deactivation failed.');
    } finally {
      setDeactivateLoading(false);
    }
  };

  // Open Reactivation Modal
  const openReactivateModal = (emp: Employee) => {
    setReactivateModalEmp(emp);
    setReactivateError(null);
    setReactivateDate(new Date().toISOString().slice(0, 10));
    setReactivateReason('');
  };

  const handleReactivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reactivateModalEmp) return;
    setReactivateLoading(true);
    setReactivateError(null);

    try {
      const res = await fetch(`/api/employees/${reactivateModalEmp.id}/reactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          effectiveDate: reactivateDate,
          reason: reactivateReason
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reactivate employee.');
      }

      setReactivateModalEmp(null);
      await fetchEmployees();
    } catch (err: any) {
      setReactivateError(err.message || 'Reactivation failed.');
    } finally {
      setReactivateLoading(false);
    }
  };

  // Open Deletion Modal
  const openDeleteModal = (emp: Employee) => {
    setDeleteModalEmp(emp);
    setDeleteConfirmation(false);
    setDeleteError(null);
    setDeleteBlockers(null);
  };

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteModalEmp) return;
    setDeleteLoading(true);
    setDeleteError(null);
    setDeleteBlockers(null);

    try {
      const res = await fetch(`/api/employees/${deleteModalEmp.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        setDeleteBlockers(data.blockers || null);
        throw new Error(data.error || 'Deletion blocked by referential integrity check.');
      }

      setDeleteModalEmp(null);
      await fetchEmployees();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete employee.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    if (statusFilter === 'active' && emp.status !== 'active') return false;
    if (statusFilter === 'inactive' && emp.status !== 'inactive') return false;

    const q = searchQuery.toLowerCase();
    return (
      emp.firstName.toLowerCase().includes(q) ||
      emp.lastName.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      emp.employeeCode.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q) ||
      (emp.designation && emp.designation.toLowerCase().includes(q))
    );
  });

  const totalHeadcount = employees.length;
  const activeCount = employees.filter((e) => e.status === 'active').length;
  const inactiveCount = employees.filter((e) => e.status === 'inactive').length;
  const activeLogins = employees.filter((e) => e.userAccount?.isActive).length;
  const enrolledBiometrics = employees.filter((e) => e.faceEnrolled).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center space-x-2.5">
            <Users className="w-6 h-6 text-[#00f2fe]" />
            <span>EMPLOYEE DIRECTORY & LIFECYCLE GOVERNANCE</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            PROVISIONING • ACTIVE/INACTIVE LIFECYCLE • REFERENTIAL DELETION SAFETY
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRegisterModal(true)}
          className="glow-btn-cyan px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center space-x-2 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>REGISTER NEW EMPLOYEE</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block">Total Staff</span>
            <span className="text-2xl font-extrabold text-white font-mono mt-0.5 block">{totalHeadcount}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#00f2fe]/10 border border-[#00f2fe]/30 text-[#00f2fe] flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-emerald-400 block">Active Employees</span>
            <span className="text-2xl font-extrabold text-emerald-400 font-mono mt-0.5 block">{activeCount}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-rose-400 block">Inactive / Separated</span>
            <span className="text-2xl font-extrabold text-rose-400 font-mono mt-0.5 block">{inactiveCount}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
            <UserX className="w-4 h-4" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-purple-400 block">Active Logins</span>
            <span className="text-2xl font-extrabold text-purple-300 font-mono mt-0.5 block">{activeLogins}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#7928ca]/10 border border-[#7928ca]/30 text-[#c084fc] flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[10px] font-mono uppercase text-cyan-300 block">Face Biometrics</span>
            <span className="text-2xl font-extrabold text-cyan-300 font-mono mt-0.5 block">{enrolledBiometrics}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#00f2fe]/10 border border-[#00f2fe]/30 text-[#00f2fe] flex items-center justify-center">
            <ScanFace className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Search & Status Filters Bar */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Status Filter Tabs */}
          <div className="flex items-center bg-[#0b0e24] p-1 rounded-xl text-xs font-semibold w-full sm:w-auto border border-white/10">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-gradient-to-r from-[#171c42] to-[#121634] text-white border border-[#7928ca]/50 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>All Employees</span>
              <span className="px-1.5 py-0.2 bg-white/10 rounded-md text-[10px] text-slate-300 font-mono">
                {totalHeadcount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-gradient-to-r from-[#171c42] to-[#121634] text-emerald-300 border border-emerald-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
              <span>Active</span>
              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded-md text-[10px] font-mono">
                {activeCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-gradient-to-r from-[#171c42] to-[#121634] text-rose-300 border border-rose-500/50 shadow-sm'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_6px_#f43f5e]" />
              <span>Inactive</span>
              <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded-md text-[10px] font-mono">
                {inactiveCount}
              </span>
            </button>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search code, name, department..."
                className="w-full pl-10 pr-4 py-2 text-xs cyber-input font-mono"
              />
            </div>

            <button
              type="button"
              onClick={fetchEmployees}
              className="glow-btn-purple p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Refresh List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>SYNC</span>
            </button>
          </div>
        </div>

        {/* Employee Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#070918]/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e122b] text-slate-400 font-mono text-[10px] uppercase tracking-wider border-b border-white/10">
              <tr>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Employee Name</th>
                <th className="py-3.5 px-4">Work Email</th>
                <th className="py-3.5 px-4">Department & Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Login Account</th>
                <th className="py-3.5 px-4">Face Biometrics</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 font-sans">
                    {loading ? 'Decrypting employee records...' : 'No employees matching the query.'}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const isActive = emp.status === 'active';

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-white/5 transition-colors ${
                        !isActive ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-cyan-300">{emp.employeeCode}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white font-sans">
                          {emp.firstName} {emp.lastName}
                        </div>
                        {!isActive && emp.deactivationDate && (
                          <div className="text-[10px] text-rose-400 font-mono">
                            Deactivated: {emp.deactivationDate}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300">{emp.email}</td>
                      <td className="py-3 px-4 text-slate-300">
                        <div>{emp.department}</div>
                        <div className="text-[10px] text-slate-400">{emp.designation}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_#f43f5e]" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>

                      {/* Linked Login Account */}
                      <td className="py-3 px-4">
                        {emp.userAccount?.isActive ? (
                          emp.userAccount?.mustChangePassword ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Pending Invite</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Active Login</span>
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-white/10">
                            <UserX className="w-3 h-3 text-slate-400" />
                            <span>Disabled Login</span>
                          </span>
                        )}
                      </td>

                      {/* Face Biometrics */}
                      <td className="py-3 px-4">
                        {emp.faceEnrolled ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                            <ScanFace className="w-3 h-3 text-[#00f2fe]" />
                            <span>Enrolled</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                            <span>Not Enrolled</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isActive && (
                            <button
                              type="button"
                              onClick={() => handleResendInvite(emp.id)}
                              className="px-2 py-1 text-[11px] font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg transition-colors cursor-pointer border border-cyan-500/30"
                              title="View or refresh activation credentials"
                            >
                              Invite
                            </button>
                          )}

                          {!isActive && emp.deactivationReason && (
                            <button
                              type="button"
                              onClick={() => setViewDetailsEmp(emp)}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer border border-white/10 flex items-center space-x-1"
                              title="View separation records"
                            >
                              <Info className="w-3 h-3 text-slate-400" />
                              <span>Details</span>
                            </button>
                          )}

                          {isAdmin && (
                            <>
                              {isActive ? (
                                <button
                                  type="button"
                                  onClick={() => openDeactivateModal(emp)}
                                  className="px-2 py-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors cursor-pointer border border-amber-500/30 flex items-center space-x-1"
                                  title="Deactivate employee and revoke access"
                                >
                                  <UserX className="w-3 h-3 text-amber-400" />
                                  <span>Deactivate</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openReactivateModal(emp)}
                                  className="px-2 py-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer border border-emerald-500/30 flex items-center space-x-1"
                                  title="Reactivate employee and restore account access"
                                >
                                  <UserCheck className="w-3 h-3 text-emerald-400" />
                                  <span>Reactivate</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => openDeleteModal(emp)}
                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Delete Employee (Referential Integrity Protected)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deactivation Modal */}
      {deactivateModalEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05060e]/85 backdrop-blur-md p-4 overflow-y-auto select-none">
          <div className="glass-panel rounded-3xl max-w-xl w-full overflow-hidden border border-white/10 my-8 shadow-2xl">
            <div className="bg-gradient-to-r from-[#171c42] via-[#101435] to-[#080b1e] px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <UserX className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">DEACTIVATE EMPLOYEE</h3>
                  <p className="text-xs text-amber-300 font-mono">
                    {deactivateModalEmp.firstName} {deactivateModalEmp.lastName} ({deactivateModalEmp.employeeCode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeactivateModalEmp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeactivateSubmit} className="p-6 space-y-4">
              {precheckLoading ? (
                <div className="p-4 bg-[#0a0d24] border border-white/10 rounded-2xl flex items-center space-x-3 text-xs text-slate-300 font-mono">
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span>Checking pending leaves, draft payrolls, and attendance records...</span>
                </div>
              ) : precheckData?.hasWarnings ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                  <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Deactivation Pre-Check Warnings:</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-amber-200 space-y-1 font-mono">
                    {precheckData.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-slate-300 italic pt-1">
                    Deactivating this employee will immediately revoke login credentials while preserving all historical records.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center space-x-2 text-xs text-emerald-300 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Pre-check passed: No conflicting pending leaves or draft payroll runs.</span>
                </div>
              )}

              {deactivateError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold">
                  {deactivateError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                    Effective Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={deactivateEffectiveDate}
                    onChange={(e) => setDeactivateEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs cyber-input font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                    Final Working Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={finalWorkingDate}
                    onChange={(e) => setFinalWorkingDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs cyber-input font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                    Separation Category *
                  </label>
                  <select
                    value={terminationCategory}
                    onChange={(e) => setTerminationCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs cyber-input"
                  >
                    <option value="Voluntary resignation" className="bg-[#0b0e24] text-white">Voluntary resignation</option>
                    <option value="End of fixed-term contract" className="bg-[#0b0e24] text-white">End of fixed-term contract</option>
                    <option value="Involuntary separation" className="bg-[#0b0e24] text-white">Involuntary separation</option>
                    <option value="Retirement" className="bg-[#0b0e24] text-white">Retirement</option>
                    <option value="Mutual agreement" className="bg-[#0b0e24] text-white">Mutual agreement</option>
                    <option value="Relocation" className="bg-[#0b0e24] text-white">Relocation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                    Primary Reason *
                  </label>
                  <select
                    value={deactivateReason}
                    onChange={(e) => setDeactivateReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs cyber-input"
                  >
                    <option value="Voluntary Resignation" className="bg-[#0b0e24] text-white">Voluntary Resignation</option>
                    <option value="Career Transition" className="bg-[#0b0e24] text-white">Career Transition</option>
                    <option value="Relocation / Family" className="bg-[#0b0e24] text-white">Relocation / Family</option>
                    <option value="Contract Expiration" className="bg-[#0b0e24] text-white">Contract Expiration</option>
                    <option value="Retirement" className="bg-[#0b0e24] text-white">Retirement</option>
                    <option value="Performance / Policy Separation" className="bg-[#0b0e24] text-white">Performance / Policy Separation</option>
                    <option value="Other" className="bg-[#0b0e24] text-white">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                  Documented Notes & Remarks
                </label>
                <textarea
                  rows={2}
                  value={customReasonDetails}
                  onChange={(e) => setCustomReasonDetails(e.target.value)}
                  placeholder="Additional context regarding handover, clearance, or notice..."
                  className="w-full px-3 py-2 text-xs cyber-input resize-none"
                />
              </div>

              {/* Rehire Eligibility Toggle */}
              <div className="glass-card border border-white/10 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Eligible for Rehire</span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    Marks whether this employee may be reinstated or rehired in future.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={rehireEligible}
                  onChange={(e) => setRehireEligible(e.target.checked)}
                  className="w-4 h-4 accent-[#00f2fe] cursor-pointer"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setDeactivateModalEmp(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deactivateLoading}
                  className="glow-btn-magenta px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-50"
                >
                  {deactivateLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UserX className="w-4 h-4" />
                  )}
                  <span>Confirm Deactivation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reactivation Modal */}
      {reactivateModalEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05060e]/85 backdrop-blur-md p-4 overflow-y-auto select-none">
          <div className="glass-panel rounded-3xl max-w-lg w-full overflow-hidden border border-white/10 my-8 shadow-2xl">
            <div className="bg-gradient-to-r from-[#171c42] via-[#101435] to-[#080b1e] px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">REACTIVATE EMPLOYEE</h3>
                  <p className="text-xs text-emerald-300 font-mono">
                    {reactivateModalEmp.firstName} {reactivateModalEmp.lastName} ({reactivateModalEmp.employeeCode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReactivateModalEmp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReactivateSubmit} className="p-6 space-y-4">
              {reactivateModalEmp.rehireEligible === false && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start space-x-2 font-mono">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Rehire Ineligibility Advisory:</strong> This employee was originally flagged as <em>ineligible for rehire</em>.
                  </div>
                </div>
              )}

              {reactivateError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold">
                  {reactivateError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                  Reactivation Effective Date *
                </label>
                <input
                  type="date"
                  required
                  value={reactivateDate}
                  onChange={(e) => setReactivateDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs cyber-input font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                  Reactivation / Rehire Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  value={reactivateReason}
                  onChange={(e) => setReactivateReason(e.target.value)}
                  placeholder="e.g. Reinstated following approved re-hire application or contract renewal..."
                  className="w-full px-3 py-2 text-xs cyber-input resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setReactivateModalEmp(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reactivateLoading}
                  className="glow-btn-cyan px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-50"
                >
                  {reactivateLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  <span>Confirm Reactivation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deletion Protection Modal */}
      {deleteModalEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05060e]/85 backdrop-blur-md p-4 overflow-y-auto select-none">
          <div className="glass-panel rounded-3xl max-w-lg w-full overflow-hidden border border-white/10 my-8 shadow-2xl">
            <div className="bg-gradient-to-r from-rose-950 via-[#1a0a1a] to-[#0a0d24] px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">PERMANENT RECORD DELETION</h3>
                  <p className="text-xs text-rose-300 font-mono">
                    {deleteModalEmp.firstName} {deleteModalEmp.lastName} ({deleteModalEmp.employeeCode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalEmp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeleteSubmit} className="p-6 space-y-4">
              <div className="glass-card border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-200 leading-relaxed flex items-start space-x-2 font-mono">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Strict Referential Integrity Policy:</strong> Permanent deletion is strictly prohibited if an employee has historical attendance, leaves, payroll items, or fallback requests.
                  Employees with any historical business records must be <strong>deactivated</strong> instead.
                </div>
              </div>

              {deleteError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs space-y-2 font-mono">
                  <div className="font-bold flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Deletion Blocked</span>
                  </div>
                  <p>{deleteError}</p>
                  {deleteBlockers && deleteBlockers.length > 0 && (
                    <ul className="list-disc list-inside text-[11px] text-rose-400 pt-1">
                      {deleteBlockers.map((b, idx) => (
                        <li key={idx}>Blocked by: {b}</li>
                      ))}
                    </ul>
                  )}
                  {deleteModalEmp.status === 'active' && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const emp = deleteModalEmp;
                          setDeleteModalEmp(null);
                          openDeactivateModal(emp);
                        }}
                        className="glow-btn-magenta px-3 py-1.5 rounded-lg text-xs uppercase font-bold"
                      >
                        Switch to Safe Deactivation Instead
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="glass-card border border-white/5 rounded-xl p-3 space-y-1 text-xs font-mono">
                <div>
                  <span className="text-slate-400">Employee Code:</span>{' '}
                  <span className="font-bold text-white">{deleteModalEmp.employeeCode}</span>
                </div>
                <div>
                  <span className="text-slate-400">Email:</span>{' '}
                  <span className="text-slate-200">{deleteModalEmp.email}</span>
                </div>
              </div>

              <div className="glass-card border border-white/5 rounded-xl p-3 flex items-start space-x-2">
                <input
                  id="confirmDelete"
                  type="checkbox"
                  required
                  checked={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.checked)}
                  className="w-4 h-4 accent-rose-500 cursor-pointer mt-0.5"
                />
                <label htmlFor="confirmDelete" className="text-xs text-slate-300 cursor-pointer font-mono">
                  I understand that permanent deletion is irreversible and can only proceed if the employee has zero historical business records.
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setDeleteModalEmp(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!deleteConfirmation || deleteLoading}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-40"
                >
                  {deleteLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>Permanently Delete</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Separation Details View Modal */}
      {viewDetailsEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05060e]/85 backdrop-blur-md p-4 overflow-y-auto select-none">
          <div className="glass-panel rounded-3xl max-w-md w-full overflow-hidden border border-white/10 my-8 shadow-2xl">
            <div className="bg-gradient-to-r from-[#171c42] via-[#101435] to-[#080b1e] px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">SEPARATION RECORD</h3>
                  <p className="text-xs text-slate-400 font-mono">{viewDetailsEmp.employeeCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewDetailsEmp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-xs font-mono">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Employee Name:</span>
                <span className="font-bold text-white font-sans">
                  {viewDetailsEmp.firstName} {viewDetailsEmp.lastName}
                </span>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Status:</span>
                <span className="font-bold text-rose-400 uppercase tracking-wider text-[11px]">
                  {viewDetailsEmp.status}
                </span>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Deactivation Date:</span>
                <span className="text-white">{viewDetailsEmp.deactivationDate || 'N/A'}</span>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Final Working Date:</span>
                <span className="text-white">{viewDetailsEmp.finalWorkingDate || 'N/A'}</span>
              </div>

              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-slate-400">Separation Reason:</span>
                <span className="text-white font-sans">{viewDetailsEmp.deactivationReason || 'Standard'}</span>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewDetailsEmp(null)}
                  className="glow-btn-cyan px-4 py-2 rounded-xl text-xs uppercase font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register New Employee Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05060e]/85 backdrop-blur-md p-4 overflow-y-auto select-none">
          <div className="glass-panel rounded-3xl max-w-xl w-full overflow-hidden border border-white/10 my-8 shadow-2xl">
            <div className="bg-gradient-to-r from-[#171c42] via-[#101435] to-[#080b1e] px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-[#00f2fe]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">REGISTER EMPLOYEE & PROVISION ACCOUNT</h3>
                  <p className="text-xs text-cyan-300 font-mono">AUTOMATIC LINKED LOGIN ACCOUNT CREATION</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="p-6 space-y-4">
              {registerError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold">
                  {registerError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Owais"
                    className="w-full px-3 py-2 text-xs cyber-input"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Shoukat"
                    className="w-full px-3 py-2 text-xs cyber-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                  Work Email (Username)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@saylaniwelfare.com"
                    className="w-full pl-9 pr-3 py-2 text-xs cyber-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs cyber-input"
                  >
                    <option value="IT & Software" className="bg-[#0b0e24] text-white">IT & Software</option>
                    <option value="Human Resources" className="bg-[#0b0e24] text-white">Human Resources</option>
                    <option value="Finance & Accounts" className="bg-[#0b0e24] text-white">Finance & Accounts</option>
                    <option value="Operations & Welfare" className="bg-[#0b0e24] text-white">Operations & Welfare</option>
                    <option value="Education & Training" className="bg-[#0b0e24] text-white">Education & Training</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-3 py-2 text-xs cyber-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                    Date of Joining
                  </label>
                  <input
                    type="date"
                    required
                    value={dateOfJoining}
                    onChange={(e) => setDateOfJoining(e.target.value)}
                    className="w-full px-3 py-2 text-xs cyber-input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                    Basic Salary (PKR)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(e.target.value)}
                    className="w-full px-3 py-2 text-xs cyber-input font-mono"
                  />
                  <span className="text-[10px] text-cyan-300 block mt-1 font-mono">
                    Gross = 1.5x Basic (PKR {(Number(basicSalary) * 1.5 || 0).toLocaleString()})
                  </span>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerLoading}
                  className="glow-btn-cyan px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-50"
                >
                  {registerLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>Register & Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal Showing One-Time Invitation Credentials */}
      {createdResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05060e]/85 backdrop-blur-md p-4 overflow-y-auto select-none">
          <div className="glass-panel rounded-3xl max-w-lg w-full overflow-hidden border border-white/10 my-8 shadow-2xl">
            <div className="bg-gradient-to-r from-[#171c42] via-[#101435] to-[#080b1e] px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <KeyRound className="w-6 h-6 text-[#00f2fe]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">INVITATION PROVISIONED</h3>
                  <p className="text-xs text-cyan-300 font-mono">ONE-TIME ACTIVATION CREDENTIALS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreatedResult(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                The employee profile and linked user account have been created. Provide the temporary credentials or one-time activation link below to the employee:
              </p>

              <div className="glass-card border border-white/10 rounded-2xl p-4 space-y-2.5 font-mono text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Employee Code:</span>
                  <span className="font-bold text-cyan-300">{createdResult.employee?.employeeCode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Work Email:</span>
                  <span className="font-bold text-white">{createdResult.employee?.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Temporary Password:</span>
                  <span className="font-bold text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded border border-purple-500/30 inline-block">
                    {createdResult.invitation?.temporaryPassword}
                  </span>
                </div>
                
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">
                    One-Time Activation Link:
                  </span>
                  <a
                    href={`${window.location.origin}/activate?token=${encodeURIComponent(
                      createdResult.invitation?.activationToken ?? ''
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#00f2fe] underline break-all hover:text-cyan-200"
                  >
                    Open Activation Page
                  </a>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="glow-btn-cyan px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center space-x-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Invitation Details'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreatedResult(null)}
                  className="px-4 py-2.5 text-slate-400 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
