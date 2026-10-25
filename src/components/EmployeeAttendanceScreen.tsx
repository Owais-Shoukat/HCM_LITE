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
  Sparkles
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
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Employee Punch Desk
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Emp Code: <strong>{employee?.employeeCode}</strong>
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Automatic Biometric Attendance</h1>
          <p className="text-xs text-slate-500">Scheduled Shift: 09:00 AM - 06:00 PM (Grace Period: 15 mins)</p>
        </div>

        {/* Status Pill */}
        <div className="flex items-center space-x-3">
          {hasCheckedOut ? (
            <div className="px-4 py-2 bg-slate-100 text-slate-700 rounded-2xl border border-slate-200 text-xs font-bold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Shift Completed Today</span>
            </div>
          ) : hasCheckedIn ? (
            <div className="px-4 py-2 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-xs font-bold flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>Checked In ({todayRecord?.status.toUpperCase()})</span>
            </div>
          ) : (
            <div className="px-4 py-2 bg-amber-50 text-amber-800 rounded-2xl border border-amber-200 text-xs font-bold flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
              <span>Pending Check-In</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Interactive Attendance Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Punch Camera & Biometrics (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ScanFace className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-slate-900 text-base">Face Verification Punch</h2>
            </div>
            {employee?.faceEnrolled ? (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Biometric Template Active</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={onGoToBiometrics}
                className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                Enroll Face First →
              </button>
            )}
          </div>

          {/* Camera View Area */}
          {!cameraActive ? (
            <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50/50 min-h-[300px]">
              <div className="w-16 h-16 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-500">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Webcam Inactive</h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Start webcam to verify your facial signature for {hasCheckedIn ? 'Check-Out' : 'Check-In'}.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-2"
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
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                  <span>Use Fallback</span>
                </button>
              </div>

              {cameraError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                  {cameraError}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Video Feed */}
              <div className="relative w-full aspect-4/3 bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />

                {/* Face Guide Oval */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={`w-52 h-68 border-2 border-dashed rounded-[50%] flex flex-col items-center justify-between py-3 transition-colors ${
                      verificationStatus === 'matched'
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : verificationStatus === 'failed'
                        ? 'border-rose-400 bg-rose-500/10'
                        : 'border-emerald-400/80'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold bg-slate-950/80 text-white px-2 py-0.5 rounded-full">
                      Align Face Here
                    </span>
                    {actionLoading && (
                      <span className="text-[11px] font-bold bg-emerald-600 text-white px-3 py-1 rounded-full animate-pulse">
                        Verifying Face...
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
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : verificationStatus === 'failed'
                      ? 'bg-rose-50 border border-rose-200 text-rose-800'
                      : 'bg-blue-50 border border-blue-200 text-blue-800'
                  }`}
                >
                  {verificationStatus === 'matched' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : verificationStatus === 'failed' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
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
                      className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2"
                    >
                      <ScanFace className="w-4 h-4" />
                      <span>{actionLoading ? 'Verifying...' : 'Verify Face & Check In'}</span>
                    </button>
                  ) : !hasCheckedOut ? (
                    <button
                      type="button"
                      disabled={actionLoading || !employee?.faceEnrolled}
                      onClick={() => handlePerformAttendance('check_out')}
                      className="px-6 py-3 bg-gradient-to-r from-teal-600 to-blue-700 hover:from-teal-700 hover:to-blue-800 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/30 transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2"
                    >
                      <ScanFace className="w-4 h-4" />
                      <span>{actionLoading ? 'Verifying...' : 'Verify Face & Check Out'}</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 font-semibold py-2">
                      Check-in and check-out already completed for today.
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={stopCamera}
                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                    title="Stop Camera"
                  >
                    <StopCircle className="w-4 h-4" />
                  </button>
                </div>

                {/* Fallback Option */}
                <button
                  type="button"
                  onClick={() => {
                    setFallbackAction(hasCheckedIn ? 'check_out' : 'check_in');
                    setShowFallbackModal(true);
                  }}
                  className="text-xs text-slate-500 hover:text-emerald-700 font-bold underline cursor-pointer"
                >
                  Camera or verification issue? Use Fallback
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Today's Status & Shift Policy (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Today's Punch Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Today's Attendance Status</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {todayRecord?.date || new Date().toISOString().slice(0, 10)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
                <span className="text-[11px] text-slate-500 block">Check-In Time</span>
                <span className="text-sm font-bold text-slate-800 font-mono">
                  {todayRecord?.checkInTime
                    ? new Date(todayRecord.checkInTime).toLocaleTimeString('en-PK', {
                        timeZone: 'Asia/Karachi',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '—'}
                </span>
                {todayRecord?.checkInMethod && (
                  <span className="text-[10px] text-slate-400 block mt-0.5 capitalize">
                    via {todayRecord.checkInMethod.replace('_', ' ')}
                  </span>
                )}
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
                <span className="text-[11px] text-slate-500 block">Check-Out Time</span>
                <span className="text-sm font-bold text-slate-800 font-mono">
                  {todayRecord?.checkOutTime
                    ? new Date(todayRecord.checkOutTime).toLocaleTimeString('en-PK', {
                        timeZone: 'Asia/Karachi',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '—'}
                </span>
                {todayRecord?.checkOutMethod && (
                  <span className="text-[10px] text-slate-400 block mt-0.5 capitalize">
                    via {todayRecord.checkOutMethod.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-500">Day Status</span>
              <span
                className={`font-bold px-2.5 py-0.5 rounded-full capitalize ${
                  todayRecord?.status === 'present'
                    ? 'bg-emerald-100 text-emerald-800'
                    : todayRecord?.status === 'late'
                    ? 'bg-amber-100 text-amber-800'
                    : todayRecord?.status === 'half_day'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {todayRecord?.status ? todayRecord.status.replace('_', ' ') : 'Not Marked'}
              </span>
            </div>

            {todayRecord?.isLate && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                <strong>Late Arrival Notice:</strong> Checked in {todayRecord.lateMinutes} minutes past scheduled shift start.
              </div>
            )}

            {todayRecord?.isHalfDay && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs">
                <strong>Half-Day Policy:</strong> Total completed work duration was under 5.0 hours.
              </div>
            )}
          </div>

          {/* Business Rules Reference */}
          <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200/80 space-y-3 text-xs text-slate-600">
            <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Official Attendance Rules</span>
            </h4>
            <ul className="space-y-1.5 list-disc list-inside leading-relaxed text-[11px]">
              <li>Check-in on or before <strong>09:15 AM PKT</strong> is marked <strong>Present</strong>.</li>
              <li>Check-in after <strong>09:15 AM PKT</strong> is recorded as <strong>Late</strong>.</li>
              <li>Work duration &lt; <strong>5.0 hours</strong> automatically counts as <strong>Half-Day</strong>.</li>
              <li>Duplicate check-ins for the same calendar date are strictly prevented.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Personal Attendance History Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            <span>My Attendance Records</span>
          </h3>
          <span className="text-xs text-slate-400">Total Records: {history.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Check-In</th>
                <th className="py-3 px-4">Check-Out</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No attendance records found yet. Mark your first check-in above!
                  </td>
                </tr>
              ) : (
                history.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">{rec.date}</td>
                    <td className="py-3 px-4 font-mono">
                      {rec.checkInTime
                        ? new Date(rec.checkInTime).toLocaleTimeString('en-PK', {
                            timeZone: 'Asia/Karachi',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '—'}
                    </td>
                    <td className="py-3 px-4 font-mono">
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
                        className={`font-bold px-2 py-0.5 rounded-full capitalize ${
                          rec.status === 'present'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rec.status === 'late'
                            ? 'bg-amber-100 text-amber-800'
                            : rec.status === 'half_day'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {rec.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-600">
                      {rec.checkInMethod ? rec.checkInMethod.replace('_', ' ') : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 text-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Authorized Fallback Attendance</h3>
                  <p className="text-xs text-slate-400">Hardware, Accessibility & Verification Exceptions</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleFallbackSubmit} className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 leading-relaxed">
                Biometric attendance is not the only way to report to work. If camera access is denied, your hardware failed, biometric consent was withdrawn, or face matching failed, you can record an authorized fallback attendance for HR review.
              </div>

              {fallbackError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                  {fallbackError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Action Type
                </label>
                <div className="flex space-x-3">
                  <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="fallbackAction"
                      value="check_in"
                      checked={fallbackAction === 'check_in'}
                      onChange={() => setFallbackAction('check_in')}
                    />
                    <span>Check In</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="fallbackAction"
                      value="check_out"
                      checked={fallbackAction === 'check_out'}
                      onChange={() => setFallbackAction('check_out')}
                    />
                    <span>Check Out</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Authorized Fallback Reason
                </label>
                <select
                  value={fallbackReason}
                  onChange={(e) => setFallbackReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="hardware_failure">Camera hardware malfunction / Not detected</option>
                  <option value="camera_denied">Browser camera permission denied</option>
                  <option value="verification_failure">Face verification failed / Lighting issues</option>
                  <option value="consent_withdrawn">Biometric consent withdrawn</option>
                  <option value="accessibility_need">Disability or accessibility accommodation</option>
                  <option value="other">Other authorized operational exception</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reason Explanation & Location Notes
                </label>
                <textarea
                  required
                  rows={3}
                  value={fallbackDetails}
                  onChange={(e) => setFallbackDetails(e.target.value)}
                  placeholder="e.g. Webcam lens cracked on work laptop. Reporting from Main Saylani Head Office 3rd floor."
                  className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowFallbackModal(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fallbackLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-50"
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
