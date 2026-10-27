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
  StopCircle,
  Cpu
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/10 shadow-lg">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-[#00f2fe]/10 border border-[#00f2fe]/30 flex items-center justify-center text-[#00f2fe]">
            <ScanFace className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">BIOMETRIC FACIAL VAULT</h1>
            <p className="text-xs text-slate-400 font-mono">128D GEOMETRIC DESCRIPTOR // AES-256-GCM ENCRYPTION</p>
          </div>
        </div>

        <div>
          {statusData?.faceEnrolled ? (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>VAULT KEY ACTIVE</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>ENROLLMENT PENDING</span>
            </span>
          )}
        </div>
      </div>

      {/* Biometric Privacy & Legal Information Sheet */}
      <div className="glass-panel border border-white/10 rounded-3xl p-6 space-y-4">
        <div className="flex items-center space-x-2 text-white font-extrabold text-sm tracking-wide">
          <Lock className="w-4 h-4 text-[#00f2fe]" />
          <span className="uppercase font-mono text-xs text-cyan-300">Biometric Information & Privacy Policy</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
          <div className="glass-card p-4 rounded-2xl border border-white/5 space-y-2">
            <div className="font-semibold text-white flex items-center space-x-1.5">
              <Eye className="w-4 h-4 text-[#00f2fe]" />
              <span>What is Collected & Why</span>
            </div>
            <p className="leading-relaxed text-slate-400">
              We extract a <strong>128-dimensional mathematical vector</strong> for instant buddy-punching-free verification. <strong>NO raw photographs or videos are ever saved</strong> to disk or cloud storage.
            </p>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-white/5 space-y-2">
            <div className="font-semibold text-white flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Encryption & Data Protection</span>
            </div>
            <p className="leading-relaxed text-slate-400">
              Biometric vectors are <strong>encrypted at rest with AES-256-GCM</strong> and isolated in a protected cryptographic vault. Templates cannot be reconstructed back into an image.
            </p>
          </div>
        </div>
      </div>

      {/* Main Enrollment / Management Section */}
      <div className="glass-panel border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        {enrollSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-sm flex items-center space-x-2 font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{enrollSuccess}</span>
          </div>
        )}

        {enrollError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-sm flex items-center space-x-2 font-medium">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{enrollError}</span>
          </div>
        )}

        {/* Existing Enrollment Details */}
        {statusData?.faceEnrolled ? (
          <div className="space-y-6">
            <div className="p-5 glass-card border border-emerald-500/30 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-emerald-300 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Your Biometric Facial Signature is Active & Verified</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Enrolled Date</span>
                  <span className="font-bold text-white">
                    {statusData.enrolledAt ? statusData.enrolledAt.slice(0, 10) : 'Active'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Template Quality</span>
                  <span className="font-bold text-cyan-300">
                    {statusData.qualityScore || 92}% Optimal
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Vault Algorithm</span>
                  <span className="font-bold text-purple-300">AES-256-GCM</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Retention Window</span>
                  <span className="font-bold text-white">365 Days</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10">
              <button
                type="button"
                onClick={handleWithdrawConsent}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Withdraw Consent & Delete Vault Key</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusData((prev: any) => ({ ...prev, faceEnrolled: false }));
                  setConsentGiven(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#121636] hover:bg-[#1a204d] text-slate-300 text-xs font-bold rounded-xl border border-white/10 transition-colors cursor-pointer"
              >
                Re-Enroll New Facial Samples
              </button>
            </div>
          </div>
        ) : (
          /* Enrollment Flow */
          <div className="space-y-6">
            {/* Informed Consent Checkbox */}
            <div className="p-4 glass-card border border-amber-500/30 rounded-2xl">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#00f2fe] cursor-pointer"
                />
                <div className="text-xs text-amber-200 leading-relaxed font-mono">
                  <strong>Explicit Informed Consent:</strong> I voluntarily consent to the collection and mathematical extraction of my 128-dimensional facial descriptor vector for employee attendance verification at Saylani Welfare International Trust. I understand that my data is protected with AES-256-GCM encryption at rest, and that I may withdraw this consent at any time.
                </div>
              </label>
            </div>

            {/* Camera Box */}
            <div className="space-y-4">
              {!isCameraActive ? (
                <div className="border border-dashed border-white/10 rounded-3xl p-10 flex flex-col items-center justify-center text-center space-y-4 bg-[#080b1e]/60">
                  <div className="w-16 h-16 rounded-full bg-[#121636] border border-white/10 flex items-center justify-center text-[#00f2fe] shadow-inner">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base">Initialize Camera for Guided Enrollment</h3>
                    <p className="text-xs text-slate-400 font-mono max-w-sm mt-1">
                      Camera access will be requested only after you initiate enrollment below.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!consentGiven}
                    onClick={startCamera}
                    className="glow-btn-cyan px-6 py-3 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Start Webcam Preview</span>
                  </button>
                  {!consentGiven && (
                    <span className="text-[11px] text-amber-400 font-mono">
                      * Please check the informed consent agreement above to activate camera.
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Camera view container with oval guide */}
                  <div className="relative w-full max-w-md mx-auto aspect-4/3 bg-[#060714] rounded-3xl overflow-hidden shadow-2xl border border-white/20">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />

                    {/* Framing Oval Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-56 h-72 border-2 border-dashed border-[#00f2fe]/80 rounded-[50%] shadow-[0_0_20px_rgba(0,242,254,0.3)] flex flex-col items-center justify-between py-4">
                        <span className="text-[10px] uppercase tracking-wider font-bold bg-[#05060e]/80 text-[#00f2fe] px-2.5 py-0.5 rounded-full border border-white/10">
                          Align Face Inside Target
                        </span>
                        {isCapturing && (
                          <div className="bg-[#7928ca] text-white text-[11px] font-bold px-3 py-1 rounded-full animate-pulse shadow-lg font-mono">
                            Capturing Sample {sampleStep} / 3...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Multi-sample progress indicator */}
                  {isCapturing && (
                    <div className="max-w-md mx-auto glass-card p-4 rounded-2xl border border-white/10 space-y-2">
                      <div className="flex justify-between text-xs font-semibold text-slate-300 font-mono">
                        <span>Quality Verification Progress</span>
                        <span className="text-cyan-400">Sample {sampleStep} of 3 ({currentQuality}%)</span>
                      </div>
                      <div className="w-full h-2 bg-[#090b1e] rounded-full overflow-hidden border border-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-[#00f2fe] to-[#7928ca] transition-all duration-300 shadow-[0_0_10px_#00f2fe]"
                          style={{ width: `${(sampleStep / 3) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {cameraError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                      {cameraError}
                    </div>
                  )}

                  {/* Camera Action Buttons */}
                  <div className="flex items-center justify-center space-x-3">
                    <button
                      type="button"
                      disabled={isCapturing}
                      onClick={handleEnrollSamples}
                      className="glow-btn-cyan px-6 py-3 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isCapturing ? 'Analyzing Biometrics...' : 'Capture 3 Quality Samples & Enroll'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-3 bg-[#121636] hover:bg-[#1a204d] text-slate-300 font-semibold text-xs rounded-xl border border-white/10 transition-colors cursor-pointer flex items-center space-x-1.5"
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
