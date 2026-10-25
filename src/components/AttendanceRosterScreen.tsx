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
  ScanFace
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
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Clock className="w-6 h-6 text-emerald-600" />
            <span>Daily Attendance Board & Exceptions Roster</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative Server Date: <strong className="text-slate-800 font-mono">{dateStr}</strong> (Asia/Karachi PKT)
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSubTab('roster')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              subTab === 'roster' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Daily Roster
          </button>
          <button
            type="button"
            onClick={() => setSubTab('fallbacks')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
              subTab === 'fallbacks' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Fallback Requests</span>
            {pendingFallbacksCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                {pendingFallbacksCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 block">On-Time Present</span>
          <span className="text-xl font-extrabold text-emerald-600">{presentCount}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 block">Late Arrivals</span>
          <span className="text-xl font-extrabold text-amber-600">{lateCount}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 block">Half-Days (&lt;5h)</span>
          <span className="text-xl font-extrabold text-blue-600">{halfDayCount}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 block">Missing Check-Out</span>
          <span className="text-xl font-extrabold text-rose-600">{missingCheckoutCount}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-slate-500 block">Pending Fallbacks</span>
          <span className="text-xl font-extrabold text-purple-600">{pendingFallbacksCount}</span>
        </div>
      </div>

      {subTab === 'roster' ? (
        /* Daily Roster Table */
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code, name, department..."
                className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <button
              type="button"
              onClick={fetchRoster}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Refresh Roster"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Check-In</th>
                  <th className="py-3 px-4">Check-Out</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Exceptions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRoster.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No roster records found.
                    </td>
                  </tr>
                ) : (
                  filteredRoster.map((r) => {
                    const att = r.attendance;
                    return (
                      <tr key={r.employee.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.employee.employeeCode}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {r.employee.firstName} {r.employee.lastName}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{r.employee.department}</td>
                        <td className="py-3 px-4 font-mono">
                          {att?.checkInTime
                            ? new Date(att.checkInTime).toLocaleTimeString('en-PK', {
                                timeZone: 'Asia/Karachi',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono">
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
                              className={`font-bold px-2 py-0.5 rounded-full capitalize ${
                                att.status === 'present'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : att.status === 'late'
                                  ? 'bg-amber-100 text-amber-800'
                                  : att.status === 'half_day'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {att.status.replace('_', ' ')}
                            </span>
                          ) : (
                            <span className="text-slate-400">Not Marked</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 capitalize">
                          {att?.checkInMethod ? (
                            <span className="flex items-center space-x-1">
                              {att.checkInMethod === 'face_verified' ? (
                                <ScanFace className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                              )}
                              <span>{att.checkInMethod.replace('_', ' ')}</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {att?.missingCheckOut && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <AlertCircle className="w-3 h-3 text-rose-500" />
                              <span>Missing Check-Out</span>
                            </span>
                          )}
                          {att?.isLate && (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 ml-1">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
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
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Authorized Fallback Attendance Review</h3>
              <p className="text-xs text-slate-500">
                Audit and approve attendance requests submitted when camera, hardware, or biometric exceptions occur.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Reason Category</th>
                  <th className="py-3 px-4">Employee Notes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fallbacks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No fallback attendance requests logged.
                    </td>
                  </tr>
                ) : (
                  fallbacks.map((fb) => (
                    <tr key={fb.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-700">
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
                        <div className="font-semibold text-slate-900">{fb.employee?.fullName || fb.employeeId}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{fb.employee?.employeeCode}</div>
                      </td>
                      <td className="py-3 px-4 capitalize font-semibold text-slate-700">
                        {fb.actionType.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 capitalize">
                        {fb.reason.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px] max-w-xs truncate" title={fb.reasonDetails}>
                        {fb.reasonDetails}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold px-2 py-0.5 rounded-full capitalize ${
                            fb.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : fb.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
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
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] rounded-lg transition-colors cursor-pointer"
                          >
                            Review
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 text-white">
              <h3 className="font-bold text-base">Review Fallback Attendance</h3>
              <p className="text-xs text-slate-400">
                Employee: {selectedFallback.employee?.fullName} ({selectedFallback.employee?.employeeCode})
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div><strong>Action:</strong> {selectedFallback.actionType.toUpperCase()}</div>
                <div><strong>Reported Reason:</strong> {selectedFallback.reason.replace('_', ' ')}</div>
                <div><strong>Employee Explanation:</strong> {selectedFallback.reasonDetails}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  HR Reviewer Comments
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g. Verified with department supervisor. Approved."
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedFallback(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    disabled={reviewLoading}
                    onClick={() => handleReviewFallback('rejected')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={reviewLoading}
                    onClick={() => handleReviewFallback('approved')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
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
