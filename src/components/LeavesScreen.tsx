import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Calendar, Plus, CheckCircle2, XCircle, Clock, ShieldAlert, ArrowRight, X } from 'lucide-react';

export function LeavesScreen() {
  const { token, user } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);

  const [leaveType, setLeaveType] = useState('casual');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [workingDays, setWorkingDays] = useState(1);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isPrivileged = user?.role === 'admin' || user?.role === 'hr';

  const fetchLeaves = async () => {
    try {
      const res = await fetch('/api/leaves', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeaves(data);
      }
    } catch (err) {
      console.error('Error fetching leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ leaveType, startDate, endDate, workingDays, reason })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit leave.');
      }
      setShowApplyModal(false);
      setReason('');
      await fetchLeaves();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/leaves/${id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchLeaves();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center space-x-2.5">
            <Calendar className="w-6 h-6 text-[#00f2fe]" />
            <span>LEAVE WORKFLOW & QUOTA BALANCES</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            ANNUAL QUOTAS: CASUAL (10) • SICK (8) • ANNUAL (14) • UNPAID (UNLIMITED)
          </p>
        </div>

        {user?.role === 'employee' && (
          <button
            type="button"
            onClick={() => setShowApplyModal(true)}
            className="glow-btn-cyan px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>APPLY FOR LEAVE</span>
          </button>
        )}
      </div>

      {/* Main Table Container */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#070918]/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e122b] text-slate-400 font-mono text-[10px] uppercase tracking-wider border-b border-white/10">
              <tr>
                <th className="py-3.5 px-4">Timeline (Start → End)</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Working Days</th>
                <th className="py-3.5 px-4">Application Reason</th>
                <th className="py-3.5 px-4">Review Status</th>
                {isPrivileged && <th className="py-3.5 px-4 text-right">Workflow Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 font-sans">
                    {loading ? 'Retrieving leave applications...' : 'No leave applications recorded.'}
                  </td>
                </tr>
              ) : (
                leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono text-cyan-300">
                      {l.startDate} → {l.endDate}
                    </td>
                    <td className="py-3 px-4 capitalize font-semibold text-white">{l.leaveType}</td>
                    <td className="py-3 px-4 font-bold text-slate-200">{l.workingDays} day(s)</td>
                    <td className="py-3 px-4 text-slate-300 font-sans max-w-xs truncate" title={l.reason}>
                      {l.reason || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-bold px-2.5 py-0.5 rounded-full capitalize text-[10px] tracking-wide border ${
                          l.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : l.status === 'rejected'
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                    {isPrivileged && (
                      <td className="py-3 px-4 text-right">
                        {l.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleApprove(l.id)}
                            className="glow-btn-magenta px-3 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wider cursor-pointer"
                          >
                            Approve
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05060e]/85 backdrop-blur-md p-4 select-none">
          <div className="glass-panel rounded-3xl max-w-md w-full overflow-hidden border border-white/10 shadow-2xl">
            <div className="bg-gradient-to-r from-[#171c42] via-[#101435] to-[#080b1e] px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-wide">
                  SUBMIT LEAVE APPLICATION
                </h3>
                <p className="text-[10px] font-mono text-cyan-400">
                  EXCLUDES WEEKENDS & OFFICIAL HOLIDAYS
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApply} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                  Leave Category
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full px-3 py-2 text-xs cyber-input"
                >
                  <option value="casual" className="bg-[#0b0e24] text-white">Casual Leave (10 days/yr)</option>
                  <option value="sick" className="bg-[#0b0e24] text-white">Sick Leave (8 days/yr)</option>
                  <option value="annual" className="bg-[#0b0e24] text-white">Annual Leave (14 days/yr)</option>
                  <option value="unpaid" className="bg-[#0b0e24] text-white">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs cyber-input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs cyber-input font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                  Calculated Working Days
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={workingDays}
                  onChange={(e) => setWorkingDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs cyber-input font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                  Reason for Request
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Urgent family obligation in Karachi."
                  className="w-full p-3 text-xs cyber-input resize-none"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="glow-btn-cyan px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <span>{submitting ? 'Submitting...' : 'Submit Request'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
