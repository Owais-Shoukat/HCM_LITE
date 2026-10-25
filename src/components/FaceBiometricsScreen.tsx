import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  ScanFace,
  ShieldCheck,
  Camera,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Lock,
  Eye,
  Info,
  Sparkles,
  StopCircle
} from 'lucide-react';
import { requestCameraStream, captureEnrollmentMultiSample } from '../utils/faceBiometrics.ts';

export function FaceBiometricsScreen() {
  const { user, employee, token, refreshMe } = useAuth();
  const [consentGiven, setConsentGiven] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusData, setStatusData] = useState<any>(null);

  // Camera & Enrollment state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [sampleStep, setSampleStep] = useState(0);
  const [currentQuality, setCurrentQuality] = useState(0);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fetchBiometricStatus = async () => {
    try {
      const res = await fetch('/api/biometrics/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
        if (data.biometricConsent) {
          setConsentGiven(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch biometric status:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchBiometricStatus();
    return () => {
      stopCamera();
    };
  }, []);
  useEffect(() => {
  if (isCameraActive && videoRef.current && streamRef.current) {
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }
}, [isCameraActive]);

  const startCamera = async () => {
  setCameraError(null);
  setEnrollError(null);
  try {
    const stream = await requestCameraStream();
    streamRef.current = stream;
    setIsCameraActive(true);
  } catch (err: any) {
    setCameraError(err.message || 'Failed to start camera.');
  }
};

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const handleEnrollSamples = async () => {
    if (!videoRef.current) return;
    setEnrollError(null);
    setEnrollSuccess(null);
    setIsCapturing(true);
    setSampleStep(1);

    try {
      // Collect 3 samples with real quality check
      const { descriptor, qualityScore } = await captureEnrollmentMultiSample(
        videoRef.current,
        (step, q) => {
          setSampleStep(step);
          setCurrentQuality(q);
        }
      );

      // Submit 128D descriptor to server
      const res = await fetch('/api/biometrics/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          descriptor,
          consentGiven: true,
          qualityScore,
          samplesCount: 3
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server rejected biometric enrollment.');
      }

      setEnrollSuccess('Biometric signature successfully encrypted and saved to vault!');
      stopCamera();
      await fetchBiometricStatus();
      await refreshMe();
    } catch (err: any) {
      setEnrollError(err.message || 'Failed to complete face enrollment.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleWithdrawConsent = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to withdraw your biometric consent? Your facial template will be permanently deleted from the vault, and you will use the authorized fallback attendance method.'
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/biometrics/consent', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to withdraw consent.');
        return;
      }

      alert('Biometric template deleted. Your consent has been withdrawn.');
      setConsentGiven(false);
      await fetchBiometricStatus();
      await refreshMe();
    } catch (err: any) {
      alert(err.message || 'Error withdrawing consent.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title & Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
            <ScanFace className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Biometric Facial Attendance Vault</h1>
            <p className="text-xs text-slate-500">Employee Informed Consent, Enrollment & Privacy Controls</p>
          </div>
        </div>

        <div>
          {statusData?.faceEnrolled ? (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Face Enrolled & Active</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Enrollment Pending</span>
            </span>
          )}
        </div>
      </div>

      {/* Biometric Privacy & Legal Information Sheet */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
          <Lock className="w-4 h-4 text-emerald-600" />
          <span>Biometric Information Disclosure & Protection Policy</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
              <Eye className="w-4 h-4 text-blue-500" />
              <span>What is Collected & Why</span>
            </div>
            <p className="leading-relaxed">
              We extract a <strong>128-dimensional mathematical facial geometry descriptor</strong> for fast, buddy-punching-free attendance verification. <strong>NO raw webcam photographs or video recordings are ever saved</strong> to disk or server databases.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Encryption & Data Protection</span>
            </div>
            <p className="leading-relaxed">
              Biometric vectors are <strong>encrypted at rest with AES-256-GCM</strong> and stored in a protected vault. Templates are never sent to external AI APIs or third parties, and cannot be reconstructed back into an image.
            </p>
          </div>
        </div>

        <div className="bg-blue-50/70 border border-blue-200/60 rounded-2xl p-3 flex items-start space-x-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <strong>Browser Requirement:</strong> Camera access requires a secure context (localhost or HTTPS in supported modern browsers). Audio is permanently disabled.
          </div>
        </div>
      </div>

      {/* Main Enrollment / Management Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
        {enrollSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex items-center space-x-2 font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{enrollSuccess}</span>
          </div>
        )}

        {enrollError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm flex items-center space-x-2 font-medium">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{enrollError}</span>
          </div>
        )}

        {/* Existing Enrollment Details */}
        {statusData?.faceEnrolled ? (
          <div className="space-y-6">
            <div className="p-5 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-emerald-950 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Your Face Biometrics Are Active</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Enrolled Date</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {statusData.enrolledAt ? statusData.enrolledAt.slice(0, 10) : 'Active'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Template Quality</span>
                  <span className="font-semibold text-emerald-700">
                    {statusData.qualityScore || 92}% Optimal
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Encryption</span>
                  <span className="font-semibold text-slate-800">AES-256-GCM</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Retention Window</span>
                  <span className="font-semibold text-slate-800">365 Days</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleWithdrawConsent}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Withdraw Consent & Delete Biometric Template</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusData((prev: any) => ({ ...prev, faceEnrolled: false }));
                  setConsentGiven(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Re-Enroll New Facial Samples
              </button>
            </div>
          </div>
        ) : (
          /* Enrollment Flow */
          <div className="space-y-6">
            {/* Informed Consent Checkbox */}
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <div className="text-xs text-amber-950 leading-relaxed">
                  <strong>Explicit Informed Consent:</strong> I voluntarily consent to the collection and mathematical extraction of my 128-dimensional facial descriptor vector for employee attendance verification at Saylani Welfare International Trust. I understand that my data is protected with AES-256-GCM encryption at rest, and that I may withdraw this consent at any time.
                </div>
              </label>
            </div>

            {/* Camera Box */}
            <div className="space-y-4">
              {!isCameraActive ? (
                <div className="border-2 border-dashed border-slate-300 rounded-3xl p-10 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50/50">
                  <div className="w-16 h-16 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-500">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Initialize Camera for Guided Enrollment</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      Camera access will be requested only after you initiate enrollment below.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!consentGiven}
                    onClick={startCamera}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Start Webcam Preview</span>
                  </button>
                  {!consentGiven && (
                    <span className="text-[11px] text-amber-700 font-medium">
                      * Please check the informed consent agreement above to activate camera.
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Camera view container with oval guide */}
                  <div className="relative w-full max-w-md mx-auto aspect-4/3 bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />

                    {/* Framing Oval Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-56 h-72 border-2 border-dashed border-emerald-400/80 rounded-[50%] shadow-[0_0_20px_rgba(16,185,129,0.3)] flex flex-col items-center justify-between py-4">
                        <span className="text-[10px] uppercase tracking-wider font-bold bg-slate-950/80 text-emerald-400 px-2 py-0.5 rounded-full">
                          Align Face Inside
                        </span>
                        {isCapturing && (
                          <div className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 rounded-full animate-pulse shadow-lg">
                            Capturing Sample {sampleStep} / 3...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Multi-sample progress indicator */}
                  {isCapturing && (
                    <div className="max-w-md mx-auto bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span>Quality Verification Progress</span>
                        <span>Sample {sampleStep} of 3 ({currentQuality}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${(sampleStep / 3) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {cameraError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                      {cameraError}
                    </div>
                  )}

                  {/* Camera Action Buttons */}
                  <div className="flex items-center justify-center space-x-3">
                    <button
                      type="button"
                      disabled={isCapturing}
                      onClick={handleEnrollSamples}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isCapturing ? 'Analyzing Biometrics...' : 'Capture 3 Quality Samples & Enroll'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5"
                    >
                      <StopCircle className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
