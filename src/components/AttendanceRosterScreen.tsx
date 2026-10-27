import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Search,
  Check,
  X,
  ScanFace,
  Terminal,
  ShieldCheck
} from 'lucide-react';
import type { FallbackAttendanceRequest } from '../types/index.ts';

interface AttendanceRosterScreenProps {
  initialSubTab?: 'roster' | 'fallbacks';
}

export function AttendanceRosterScreen({ initialSubTab = 'roster' }: AttendanceRosterScreenProps) {
  const { token, user } = useAuth();
  const [subTab, setSubTab] = useState<'roster' | 'fallbacks'>(initialSubTab);
  const [rosterData, setRosterData] = useState<any[]>([]);
  const [fallbacks, setFallbacks] = useState<FallbackAttendanceRequest[]>([]);
  const [dateStr, setDateStr] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fallback Review Modal state
  const [selectedFallback, setSelectedFallback] = useState<FallbackAttendanceRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchRoster = async () => {
    setLoading(true);
    try {
      // 1. Fetch Today's Roster
      const res = await fetch('/api/attendance/today', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRosterData(data.roster || []);
        setDateStr(data.date);
      }

      // 2. Fetch Fallback Requests
      const fbRes = await fetch('/api/attendance/fallbacks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (fbRes.ok) {
        const fbData = await fbRes.json();
        setFallbacks(fbData);
      }
    } catch (err) {
      console.error('Error fetching roster:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  const handleReviewFallback = async (status: 'approved' | 'rejected') => {
    if (!selectedFallback) return;
    setReviewLoading(true);
    try {
      const res = await fetch(`/api/attendance/fallbacks/${selectedFallback.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status, reviewNotes })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to review request.');
        return;
      }

      setSelectedFallback(null);
      setReviewNotes('');
      await fetchRoster();
    } catch (err: any) {
      alert(err.message || 'Error updating fallback request.');
    } finally {
      setReviewLoading(false);
    }
  };

  // Metrics
  const totalEmployees = rosterData.length;
  const presentCount = rosterData.filter(
    (r) => r.attendance?.status === 'present' && !r.attendance?.isLate
  ).length;
  const lateCount = rosterData.filter((r) => r.attendance?.isLate).length;
  const halfDayCount = rosterData.filter((r) => r.attendance?.status === 'half_day').length;
  const missingCheckoutCount = rosterData.filter((r) => r.attendance?.missingCheckOut).length;
  const pendingFallbacksCount = fallbacks.filter((f) => f.status === 'pending').length;

  const filteredRoster = rosterData.filter((r) => {
    const q = searchQuery.toLowerCase();
    const name = `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase();
    const code = r.employee.employeeCode.toLowerCase();
    const dept = r.employee.department.toLowerCase();
    return name.includes(q) || code.includes(q) || dept.includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner Card */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center space-x-2.5">
            <Clock className="w-6 h-6 text-[#00f2fe]" />
            <span>ATTENDANCE ROSTER & EXCEPTIONS BOARD</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            AUTHORITATIVE DATE: <strong className="text-cyan-400">{dateStr}</strong> (PKT ASIA/KARACHI)
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex bg-[#0b0e24] p-1 rounded-2xl border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSubTab('roster')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              subTab === 'roster'
                ? 'bg-gradient-to-r from-[#171c42] to-[#121634] text-white border border-[#7928ca]/50 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Daily Roster
          </button>
          <button
            type="button"
            onClick={() => setSubTab('fallbacks')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
              subTab === 'fallbacks'
                ? 'bg-gradient-to-r from-[#171c42] to-[#121634] text-white border border-[#7928ca]/50 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Fallback Approvals</span>
            {pendingFallbacksCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#ff0080] text-white text-[10px] flex items-center justify-center font-bold">
                {pendingFallbacksCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Metric Cards (5 Pillars) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-white/10">
          <span className="text-[10px] font-mono uppercase text-slate-400 block">On-Time Present</span>
          <span className="text-2xl font-extrabold text-emerald-400 font-mono mt-0.5 block">{presentCount}</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10">
          <span className="text-[10px] font-mono uppercase text-slate-400 block">Late Arrivals</span>
          <span className="text-2xl font-extrabold text-amber-400 font-mono mt-0.5 block">{lateCount}</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10">
          <span className="text-[10px] font-mono uppercase text-slate-400 block">Half-Days (&lt;5h)</span>
          <span className="text-2xl font-extrabold text-cyan-400 font-mono mt-0.5 block">{halfDayCount}</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10">
          <span className="text-[10px] font-mono uppercase text-slate-400 block">Missing Check-Out</span>
          <span className="text-2xl font-extrabold text-rose-400 font-mono mt-0.5 block">{missingCheckoutCount}</span>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/10 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 block">Pending Fallbacks</span>
          <span className="text-2xl font-extrabold text-purple-400 font-mono mt-0.5 block">{pendingFallbacksCount}</span>
        </div>
      </div>

      {subTab === 'roster' ? (
        /* Daily Roster Table */
        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code, employee, dept..."
                className="w-full pl-10 pr-4 py-2 text-xs cyber-input font-mono"
              />
            </div>

            <button
              type="button"
              onClick={fetchRoster}
              className="glow-btn-purple p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Refresh Roster"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>SYNC ROSTER</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#070918]/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0e122b] text-slate-400 font-mono text-[10px] uppercase tracking-wider border-b border-white/10">
                <tr>
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Check-In</th>
                  <th className="py-3.5 px-4">Check-Out</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Verification</th>
                  <th className="py-3.5 px-4">Exceptions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                {filteredRoster.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 font-sans">
                      {loading ? 'Decrypting live attendance roster...' : 'No roster records found.'}
                    </td>
                  </tr>
                ) : (
                  filteredRoster.map((r) => {
                    const att = r.attendance;
                    return (
                      <tr key={r.employee.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-bold text-cyan-300">{r.employee.employeeCode}</td>
                        <td className="py-3 px-4 font-semibold text-white font-sans">
                          {r.employee.firstName} {r.employee.lastName}
                        </td>
                        <td className="py-3 px-4 text-slate-400">{r.employee.department}</td>
                        <td className="py-3 px-4 text-slate-300">
                          {att?.checkInTime
                            ? new Date(att.checkInTime).toLocaleTimeString('en-PK', {
                                timeZone: 'Asia/Karachi',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {att?.checkOutTime
                            ? new Date(att.checkOutTime).toLocaleTimeString('en-PK', {
                                timeZone: 'Asia/Karachi',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {att ? (
                            <span
                              className={`font-bold px-2 py-0.5 rounded-full capitalize text-[10px] border ${
                                att.status === 'present'
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                  : att.status === 'late'
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                  : att.status === 'half_day'
                                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                                  : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                              }`}
                            >
                              {att.status.replace('_', ' ')}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-sans">Not Marked</span>
                          )}
                        </td>
                        <td className="py-3 px-4 capitalize">
                          {att?.checkInMethod ? (
                            <span className="flex items-center space-x-1.5 text-cyan-300 text-[10px]">
                              {att.checkInMethod === 'face_verified' ? (
                                <ScanFace className="w-3.5 h-3.5 text-[#00f2fe]" />
                              ) : (
                                <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                              )}
                              <span>{att.checkInMethod.replace('_', ' ')}</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {att?.missingCheckOut && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                              <span>Missing Check-Out</span>
                            </span>
                          )}
                          {att?.isLate && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 ml-1">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>Late (+{att.lateMinutes}m)</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Fallback Requests Tab */
        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="border-b border-white/10 pb-3">
            <h3 className="font-extrabold text-white text-base">AUTHORIZED MANUAL FALLBACK AUDIT</h3>
            <p className="text-xs text-slate-400 font-mono">
              SUPERVISOR APPROVAL FOR HARDWARE OR BIOMETRIC CAMERA EXCEPTIONS
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#070918]/60">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0e122b] text-slate-400 text-[10px] uppercase tracking-wider border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">Timestamp (PKT)</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Reason Category</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[11px]">
                {fallbacks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 font-sans">
                      No fallback attendance requests logged.
                    </td>
                  </tr>
                ) : (
                  fallbacks.map((fb) => (
                    <tr key={fb.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 text-slate-300">
                        <div>{fb.date}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(fb.requestedTimestamp).toLocaleTimeString('en-PK', {
                            timeZone: 'Asia/Karachi',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white font-sans">{fb.employee?.fullName || fb.employeeId}</div>
                        <div className="text-[10px] text-cyan-400">{fb.employee?.employeeCode}</div>
                      </td>
                      <td className="py-3 px-4 capitalize font-semibold text-purple-300">
                        {fb.actionType.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 capitalize text-slate-300">
                        {fb.reason.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans max-w-xs truncate" title={fb.reasonDetails}>
                        {fb.reasonDetails}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold px-2 py-0.5 rounded-full capitalize text-[10px] border ${
                            fb.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : fb.status === 'rejected'
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {fb.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {fb.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => setSelectedFallback(fb)}
                            className="glow-btn-cyan px-3 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wider cursor-pointer"
                          >
                            Review
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            by {fb.reviewedBy || 'HR'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Dialog */}
      {selectedFallback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05060e]/85 backdrop-blur-md p-4 select-none">
          <div className="glass-panel rounded-3xl max-w-md w-full overflow-hidden border border-white/10 shadow-2xl">
            <div className="bg-gradient-to-r from-[#171c42] via-[#101435] to-[#080b1e] px-6 py-5 border-b border-white/10">
              <h3 className="font-extrabold text-base text-white">REVIEW FALLBACK ATTENDANCE</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {selectedFallback.employee?.fullName} ({selectedFallback.employee?.employeeCode})
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-[#0b0e24] p-3.5 rounded-xl border border-white/10 space-y-1.5 font-mono">
                <div><strong className="text-cyan-400">Action:</strong> {selectedFallback.actionType.toUpperCase()}</div>
                <div><strong className="text-purple-400">Category:</strong> {selectedFallback.reason.replace('_', ' ')}</div>
                <div className="text-slate-300 font-sans mt-1"><strong>Details:</strong> {selectedFallback.reasonDetails}</div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                  HR Reviewer Audit Notes
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g. Verified with department supervisor. Approved."
                  className="w-full p-3 text-xs cyber-input resize-none"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedFallback(null)}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    disabled={reviewLoading}
                    onClick={() => handleReviewFallback('rejected')}
                    className="px-4 py-2 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={reviewLoading}
                    onClick={() => handleReviewFallback('approved')}
                    className="glow-btn-cyan px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
