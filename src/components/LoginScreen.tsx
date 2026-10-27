import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Mail, Lock, KeyRound, Building2, ScanFace, CheckCircle2, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export function LoginScreen() {
  const { login, activateAccount } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'activate'>('login');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      setTokenInput(token);
      setActiveTab('activate');
    }
  }, []);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Activation form state
  const [tokenInput, setTokenInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activateLoading, setActivateLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivateError(null);

    if (newPassword.length < 8) {
      setActivateError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setActivateError('Passwords do not match.');
      return;
    }

    setActivateLoading(true);
    try {
      await activateAccount(tokenInput.trim(), newPassword);
    } catch (err: any) {
      setActivateError(err.message || 'Account activation failed.');
    } finally {
      setActivateLoading(false);
    }
  };

  return (
    <div className="min-h-screen cyber-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden select-none">
      {/* Background Ambient Aura Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#7928ca]/25 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-[#00f2fe]/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-[#ff0080]/15 rounded-full blur-[130px] pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="flex justify-center">
          <div className="relative group">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-[#7928ca] via-[#ff0080] to-[#00f2fe] rounded-2xl blur-md opacity-80 group-hover:opacity-100 transition duration-300"></div>
            <div className="relative w-16 h-16 rounded-2xl bg-[#0a0d24] border border-white/20 flex items-center justify-center shadow-2xl">
              <Building2 className="w-8 h-8 text-[#00f2fe]" />
            </div>
          </div>
        </div>

        <h2 className="mt-5 text-center text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          SAYLANI <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f2fe] via-[#7928ca] to-[#ff0080]">HCM LITE</span>
        </h2>
        <p className="mt-1.5 text-center text-xs font-mono tracking-wider text-slate-400 uppercase">
          WORKSPACE ACCESS // QUANTUM PORTAL
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="glass-panel rounded-3xl overflow-hidden border border-white/10">
          {/* Futuristic Tabs */}
          <div className="flex border-b border-white/10 bg-[#090c22]/60 backdrop-blur-md">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-3.5 text-center text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
                activeTab === 'login'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
              {activeTab === 'login' && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-[#00f2fe] via-[#7928ca] to-[#ff0080] shadow-[0_0_8px_#00f2fe]"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('activate')}
              className={`flex-1 py-3.5 text-center text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
                activeTab === 'activate'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Activate Profile
              {activeTab === 'activate' && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-[#00f2fe] via-[#7928ca] to-[#ff0080] shadow-[0_0_8px_#ff0080]"></span>
              )}
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {activeTab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold">
                    {loginError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                    Authorized Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@saylaniwelfare.com"
                      className="w-full pl-10 pr-4 py-2.5 text-sm cyber-input"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300">
                      Security Password
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-4 py-2.5 text-sm cyber-input"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full py-3 glow-btn-cyan rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    <span>{loginLoading ? 'AUTHENTICATING...' : 'ENTER SAYLANI WORKSPACE'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-2 text-center">
                  <p className="text-xs text-slate-400">
                    Received an invitation token?{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('activate')}
                      className="text-[#00f2fe] font-bold hover:underline cursor-pointer ml-1"
                    >
                      Activate account
                    </button>
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleActivate} className="space-y-4">
                <div className="bg-[#121636]/60 border border-white/10 rounded-xl p-3 text-xs text-slate-300 leading-relaxed">
                  Enter your 64-character one-time activation token provided by Admin/HR to set your permanent credentials.
                </div>

                {activateError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold">
                    {activateError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                    One-Time Token
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="Paste activation token"
                      className="w-full pl-10 pr-4 py-2.5 text-sm font-mono cyber-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                    Permanent Password (min 8 chars)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-4 py-2.5 text-sm cyber-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <CheckCircle2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-4 py-2.5 text-sm cyber-input"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={activateLoading}
                    className="w-full py-3 glow-btn-magenta rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    <span>{activateLoading ? 'PROVISIONING...' : 'ACTIVATE & ENTER HCM'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Security Badge Footer */}
        <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-slate-400">
          <ScanFace className="w-4 h-4 text-[#00f2fe]" />
          <span>Protected with AES-256-GCM Biometric Vault & Server-Authoritative Verification</span>
        </div>
      </div>
    </div>
  );
}
