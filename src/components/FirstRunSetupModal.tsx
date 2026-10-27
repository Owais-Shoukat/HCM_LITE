import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { ShieldCheck, User, Mail, Lock, Building2, Sparkles, ArrowRight } from 'lucide-react';

export function FirstRunSetupModal() {
  const { setupAdmin } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      await setupAdmin(fullName, email, password);
    } catch (err: any) {
      setError(err.message || 'Setup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center cyber-bg p-4 select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-[#7928ca]/25 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-[#00f2fe]/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="glass-panel rounded-3xl max-w-lg w-full overflow-hidden border border-white/10 shadow-2xl relative z-10">
        <div className="bg-gradient-to-r from-[#171c42] via-[#101435] to-[#080b1e] px-8 py-8 border-b border-white/10 relative">
          <div className="flex items-center space-x-3 mb-2">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#7928ca] to-[#00f2fe] rounded-2xl blur-sm opacity-80"></div>
              <div className="relative w-12 h-12 rounded-2xl bg-[#0a0d24] border border-white/20 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-[#00f2fe]" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-white">
                SAYLANI <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f2fe] to-[#7928ca]">HCM LITE</span>
              </h2>
              <p className="text-[11px] font-mono tracking-wider text-cyan-400 uppercase">
                FIRST-RUN MASTER INITIALIZATION
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            Welcome to Saylani Welfare International Trust HCM. Please provision your primary Administrator account to initialize role-based governance.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
              Admin Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Master Administrator"
                className="w-full pl-10 pr-4 py-2.5 text-sm cyber-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
              Admin Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@saylaniwelfare.com"
                className="w-full pl-10 pr-4 py-2.5 text-sm cyber-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300 mb-1.5">
              Master Password (min 8 characters)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                minLength={8}
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
              disabled={loading}
              className="w-full py-3 glow-btn-cyan rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'INITIALIZING SYSTEM...' : 'COMPLETE SETUP & INITIALIZE'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
