import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Clock,
  ScanFace,
  CheckCircle2,
  AlertCircle,
  Camera,
  StopCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  X
} from 'lucide-react';
import { requestCameraStream, extractFrameDescriptor } from '../utils/faceBiometrics.ts';
import type { AttendanceRecord } from '../types/index.ts';

interface AttendanceScreenProps {
  onGoToBiometrics: () => void;
}

export function EmployeeAttendanceScreen({ onGoToBiometrics }: AttendanceScreenProps) {
  const { user, employee, token } = useAuth();

  // Attendance state
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Camera & Verification state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string>('idle'); // idle | verifying | matched | failed
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fallback Modal state
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [fallbackAction, setFallbackAction] = useState<'check_in' | 'check_out'>('check_in');
  const [fallbackReason, setFallbackReason] = useState<string>('hardware_failure');
  const [fallbackDetails, setFallbackDetails] = useState<string>('');
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchAttendance = async () => {
    try {
      // 1. Fetch Today
      const todayRes = await fetch('/api/attendance/today', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (todayRes.ok) {
        const todayData = await todayRes.json();
        setTodayRecord(todayData.attendance);
      }

      // 2. Fetch History
      const histRes = await fetch('/api/attendance/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData);
      }
    } catch (err) {
      console.error('Error loading attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const startCamera = async () => {
    setCameraError(null);
    setVerificationMessage(null);
    try {
      const stream = await requestCameraStream();
      streamRef.current = stream;
      setCameraActive(true);
      setVerificationStatus('idle');
    } catch (err: any) {
      setCameraError(err.message || 'Could not access webcam.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setVerificationStatus('idle');
  };

  /**
   * Performs real face verification and marks check-in or check-out
   */
  const handlePerformAttendance = async (action: 'check_in' | 'check_out') => {
    if (!videoRef.current) return;
    setVerificationStatus('verifying');
    setVerificationMessage('Extracting 128D biometric vector and verifying with server...');
    setActionLoading(true);

    try {
      // 1. Extract candidate descriptor from live webcam
      const captureResult = extractFrameDescriptor(videoRef.current);
      if (!captureResult.success || !captureResult.descriptor) {
        throw new Error(captureResult.error || 'Failed to capture quality face frame. Align face in oval.');
      }

      // 2. Submit candidate descriptor to server for cryptographic verification
      const verifyRes = await fetch('/api/biometrics/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          descriptor: captureResult.descriptor,
          action
        })
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) {
        setVerificationStatus('failed');
        throw new Error(verifyData.error || 'Face verification failed: biometric template mismatch.');
      }

      setVerificationStatus('matched');
      setVerificationMessage(
        `Biometric signature verified! (Match Similarity: ${(verifyData.similarity * 100).toFixed(1)}%). Submitting ${action === 'check_in' ? 'Check-In' : 'Check-Out'}...`
      );

      // 3. Submit attendance with authoritative server proof token
      const endpoint = action === 'check_in' ? '/api/attendance/check-in' : '/api/attendance/check-out';
      const attRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          verificationToken: verifyData.verificationToken
        })
      });

      const attData = await attRes.json();
      if (!attRes.ok) {
        throw new Error(attData.error || 'Failed to record attendance.');
      }

      setVerificationMessage(attData.message);
      stopCamera();
      await fetchAttendance();
    } catch (err: any) {
      setVerificationStatus('failed');
      setVerificationMessage(err.message || 'Attendance action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Submit Fallback Attendance Request
   */
  const handleFallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFallbackError(null);
    if (!fallbackDetails.trim()) {
      setFallbackError('Please explain the reason for using fallback attendance.');
      return;
    }

    setFallbackLoading(true);
    try {
      const res = await fetch('/api/attendance/fallback-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          actionType: fallbackAction,
          reason: fallbackReason,
          reasonDetails: fallbackDetails
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit fallback attendance.');
      }

      setShowFallbackModal(false);
      setFallbackDetails('');
      stopCamera();
      await fetchAttendance();
      alert(data.message || 'Fallback attendance recorded and flagged for HR review.');
    } catch (err: any) {
      setFallbackError(err.message || 'Error submitting fallback attendance.');
    } finally {
      setFallbackLoading(false);
    }
  };

  const hasCheckedIn = Boolean(todayRecord?.checkInTime);
  const hasCheckedOut = Boolean(todayRecord?.checkOutTime);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Banner: Status Overview */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
              EMPLOYEE PUNCH DESK
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Emp Code: <strong className="text-white">{employee?.employeeCode}</strong>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-1.5 tracking-tight">
            AUTOMATIC BIOMETRIC ATTENDANCE
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            SCHEDULED SHIFT: 09:00 AM - 06:00 PM PKT (GRACE: 15 MINS)
          </p>
        </div>

        {/* Status Pill */}
        <div className="flex items-center space-x-3">
          {hasCheckedOut ? (
            <div className="px-4 py-2 bg-slate-800/80 text-slate-300 rounded-2xl border border-white/10 text-xs font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Shift Completed Today</span>
            </div>
          ) : hasCheckedIn ? (
            <div className="px-4 py-2 bg-emerald-500/10 text-emerald-300 rounded-2xl border border-emerald-500/30 text-xs font-bold flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
              <span>Checked In ({todayRecord?.status.toUpperCase()})</span>
            </div>
          ) : (
            <div className="px-4 py-2 bg-amber-500/10 text-amber-300 rounded-2xl border border-amber-500/30 text-xs font-bold flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
              <span>Pending Check-In</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Interactive Attendance Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Punch Camera & Biometrics (7 Cols) */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 border border-white/10 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center space-x-2">
              <ScanFace className="w-5 h-5 text-[#00f2fe]" />
              <h2 className="font-extrabold text-white text-base">Face Verification Kiosk</h2>
            </div>
            {employee?.faceEnrolled ? (
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Vault Key Active</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={onGoToBiometrics}
                className="text-[10px] font-mono uppercase tracking-wider text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30 hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                Enroll Biometrics First →
              </button>
            )}
          </div>

          {/* Camera View Area */}
          {!cameraActive ? (
            <div className="border border-dashed border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4 bg-[#080b1e]/60 min-h-[300px]">
              <div className="w-16 h-16 rounded-full bg-[#121636] border border-white/10 flex items-center justify-center text-[#00f2fe] shadow-inner">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-sm">Webcam Scanner Offline</h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1 font-mono">
                  Activate webcam to verify your facial signature for {hasCheckedIn ? 'Check-Out' : 'Check-In'}.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="glow-btn-cyan px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer flex items-center space-x-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Camera Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFallbackAction(hasCheckedIn ? 'check_out' : 'check_in');
                    setShowFallbackModal(true);
                  }}
                  className="px-4 py-2.5 bg-[#121636] hover:bg-[#1a204d] text-slate-300 font-semibold text-xs rounded-xl border border-white/10 transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                  <span>Use Fallback</span>
                </button>
              </div>

              {cameraError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold">
                  {cameraError}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Video Feed */}
              <div className="relative w-full aspect-4/3 bg-[#060714] rounded-3xl overflow-hidden shadow-2xl border border-white/20">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />

                {/* Face Guide Oval HUD */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`w-52 h-68 border-2 border-dashed rounded-[50%] flex flex-col items-center justify-between py-3 transition-colors ${
                      verificationStatus === 'matched'
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : verificationStatus === 'failed'
                        ? 'border-rose-400 bg-rose-500/10'
                        : 'border-[#00f2fe]/80'
                    }`}
                  >
                    <span className="text-[10px] font-mono uppercase tracking-widest bg-[#05060e]/80 text-cyan-300 px-2.5 py-0.5 rounded-full border border-white/10">
                      ALIGN FACE IN TARGET
                    </span>
                    {actionLoading && (
                      <span className="text-[11px] font-bold bg-[#7928ca] text-white px-3 py-1 rounded-full animate-pulse shadow-md">
                        VERIFYING DESCRIPTOR...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Message */}
              {verificationMessage && (
                <div
                  className={`p-3 rounded-2xl text-xs font-semibold flex items-center space-x-2 ${
                    verificationStatus === 'matched'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : verificationStatus === 'failed'
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                      : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300'
                  }`}
                >
                  {verificationStatus === 'matched' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : verificationStatus === 'failed' ? (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                  <span>{verificationMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center space-x-2">
                  {!hasCheckedIn ? (
                    <button
                      type="button"
                      disabled={actionLoading || !employee?.faceEnrolled}
                      onClick={() => handlePerformAttendance('check_in')}
                      className="glow-btn-cyan px-6 py-3 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2"
                    >
                      <ScanFace className="w-4 h-4" />
                      <span>{actionLoading ? 'VERIFYING...' : 'VERIFY & CHECK IN'}</span>
                    </button>
                  ) : !hasCheckedOut ? (
                    <button
                      type="button"
                      disabled={actionLoading || !employee?.faceEnrolled}
                      onClick={() => handlePerformAttendance('check_out')}
                      className="glow-btn-magenta px-6 py-3 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2"
                    >
                      <ScanFace className="w-4 h-4" />
                      <span>{actionLoading ? 'VERIFYING...' : 'VERIFY & CHECK OUT'}</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-mono py-2">
                      Check-in and check-out already recorded for today.
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={stopCamera}
                    className="p-3 bg-[#121636] hover:bg-[#1a204d] text-slate-300 rounded-xl border border-white/10 transition-colors cursor-pointer"
                    title="Stop Camera"
                  >
                    <StopCircle className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFallbackAction(hasCheckedIn ? 'check_out' : 'check_in');
                    setShowFallbackModal(true);
                  }}
                  className="text-xs text-[#00f2fe] hover:underline font-bold cursor-pointer"
                >
                  Camera issue? Use Fallback
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Today's Status & Shift Policy (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Today's Punch Card */}
          <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-extrabold text-white text-sm flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-[#00f2fe]" />
                <span>Today's Attendance Status</span>
              </h3>
              <span className="text-xs text-cyan-300 font-mono">
                {todayRecord?.date || new Date().toISOString().slice(0, 10)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-3.5 rounded-2xl border border-white/5">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">Check-In Time</span>
                <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                  {todayRecord?.checkInTime
                    ? new Date(todayRecord.checkInTime).toLocaleTimeString('en-PK', {
                        timeZone: 'Asia/Karachi',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '—'}
                </span>
                {todayRecord?.checkInMethod && (
                  <span className="text-[10px] text-cyan-400 block mt-1 capitalize font-mono">
                    via {todayRecord.checkInMethod.replace('_', ' ')}
                  </span>
                )}
              </div>

              <div className="glass-card p-3.5 rounded-2xl border border-white/5">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">Check-Out Time</span>
                <span className="text-sm font-bold text-white font-mono mt-0.5 block">
                  {todayRecord?.checkOutTime
                    ? new Date(todayRecord.checkOutTime).toLocaleTimeString('en-PK', {
                        timeZone: 'Asia/Karachi',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '—'}
                </span>
                {todayRecord?.checkOutMethod && (
                  <span className="text-[10px] text-cyan-400 block mt-1 capitalize font-mono">
                    via {todayRecord.checkOutMethod.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>

            <div className="p-3.5 glass-card rounded-2xl border border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-mono">Shift Evaluation</span>
              <span
                className={`font-bold px-2.5 py-0.5 rounded-full capitalize text-[10px] border ${
                  todayRecord?.status === 'present'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : todayRecord?.status === 'late'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : todayRecord?.status === 'half_day'
                    ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                }`}
              >
                {todayRecord?.status ? todayRecord.status.replace('_', ' ') : 'Not Marked'}
              </span>
            </div>

            {todayRecord?.isLate && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                <strong>Late Arrival Notice:</strong> Checked in {todayRecord.lateMinutes} minutes past scheduled shift start.
              </div>
            )}

            {todayRecord?.isHalfDay && (
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-300 text-xs">
                <strong>Half-Day Notice:</strong> Total logged work duration was under 5.0 hours.
              </div>
            )}
          </div>

          {/* Business Rules Reference */}
          <div className="glass-panel rounded-3xl p-5 border border-white/10 space-y-3 text-xs text-slate-300">
            <h4 className="font-extrabold text-white flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-[#00f2fe]" />
              <span>Official Attendance Policy</span>
            </h4>
            <ul className="space-y-1.5 list-disc list-inside leading-relaxed text-[11px] font-mono text-slate-400">
              <li>Arrivals ≤ <strong>09:15 AM PKT</strong> marked <strong>Present</strong>.</li>
              <li>Arrivals &gt; <strong>09:15 AM PKT</strong> recorded as <strong>Late</strong>.</li>
              <li>Work duration &lt; <strong>5.0 hours</strong> evaluated as <strong>Half-Day</strong>.</li>
              <li>Duplicate check-ins strictly blocked on server.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Personal Attendance History Table */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="font-extrabold text-white text-base flex items-center space-x-2">
            <Clock className="w-5 h-5 text-[#00f2fe]" />
            <span>My Attendance History</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">Total Records: {history.length}</span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#070918]/60">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0e122b] text-slate-400 text-[10px] uppercase tracking-wider border-b border-white/10">
              <tr>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Check-In</th>
                <th className="py-3.5 px-4">Check-Out</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Method</th>
                <th className="py-3.5 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-[11px]">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 font-sans">
                    No attendance records found yet. Mark your first check-in above!
                  </td>
                </tr>
              ) : (
                history.map((rec) => (
                  <tr key={rec.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-bold text-cyan-300">{rec.date}</td>
                    <td className="py-3 px-4 text-slate-300">
                      {rec.checkInTime
                        ? new Date(rec.checkInTime).toLocaleTimeString('en-PK', {
                            timeZone: 'Asia/Karachi',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {rec.checkOutTime
                        ? new Date(rec.checkOutTime).toLocaleTimeString('en-PK', {
                            timeZone: 'Asia/Karachi',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full capitalize text-[10px] border ${
                          rec.status === 'present'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : rec.status === 'late'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : rec.status === 'half_day'
                            ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                        }`}
                      >
                        {rec.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-400">
                      {rec.checkInMethod ? rec.checkInMethod.replace('_', ' ') : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate font-sans">
                      {rec.notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fallback Attendance Modal */}
      {showFallbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05060e]/85 backdrop-blur-md p-4 select-none">
          <div className="glass-panel rounded-3xl max-w-lg w-full overflow-hidden border border-white/10 shadow-2xl">
            <div className="bg-gradient-to-r from-[#171c42] via-[#101435] to-[#080b1e] px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-[#00f2fe]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">RECORD FALLBACK ATTENDANCE</h3>
                  <p className="text-xs text-slate-400 font-mono">Hardware & Biometric Camera Exceptions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFallbackModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFallbackSubmit} className="p-6 space-y-4">
              <div className="bg-[#0b0e24] border border-white/10 rounded-xl p-3 text-xs text-slate-300 leading-relaxed font-mono">
                Biometric attendance is not the only way to report to work. If camera access is denied, your hardware failed, or lighting prevents matching, submit an authorized fallback attendance for supervisor review.
              </div>

              {fallbackError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold">
                  {fallbackError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                  Action Type
                </label>
                <div className="flex space-x-4 text-xs font-mono">
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="fallbackAction"
                      value="check_in"
                      checked={fallbackAction === 'check_in'}
                      onChange={() => setFallbackAction('check_in')}
                      className="accent-[#00f2fe]"
                    />
                    <span>Check In</span>
                  </label>
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="fallbackAction"
                      value="check_out"
                      checked={fallbackAction === 'check_out'}
                      onChange={() => setFallbackAction('check_out')}
                      className="accent-[#00f2fe]"
                    />
                    <span>Check Out</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                  Authorized Fallback Reason
                </label>
                <select
                  value={fallbackReason}
                  onChange={(e) => setFallbackReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs cyber-input font-medium"
                >
                  <option value="hardware_failure" className="bg-[#0b0e24] text-white">Camera hardware malfunction / Not detected</option>
                  <option value="camera_denied" className="bg-[#0b0e24] text-white">Browser camera permission denied</option>
                  <option value="verification_failure" className="bg-[#0b0e24] text-white">Face verification failed / Lighting issues</option>
                  <option value="consent_withdrawn" className="bg-[#0b0e24] text-white">Biometric consent withdrawn</option>
                  <option value="accessibility_need" className="bg-[#0b0e24] text-white">Disability or accessibility accommodation</option>
                  <option value="other" className="bg-[#0b0e24] text-white">Other authorized operational exception</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                  Reason Explanation & Location Notes
                </label>
                <textarea
                  required
                  rows={3}
                  value={fallbackDetails}
                  onChange={(e) => setFallbackDetails(e.target.value)}
                  placeholder="e.g. Webcam lens damaged on work laptop. Reporting from Saylani Head Office."
                  className="w-full p-3 text-xs cyber-input resize-none"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowFallbackModal(false)}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fallbackLoading}
                  className="glow-btn-cyan px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {fallbackLoading ? 'Submitting...' : 'Record Fallback Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
