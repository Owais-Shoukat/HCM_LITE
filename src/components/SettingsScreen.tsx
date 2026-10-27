import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Settings as SettingsIcon, Save, Clock, ScanFace, Globe, Shield, Sliders, CheckCircle2 } from 'lucide-react';
import type { CompanySettings } from '../types/index.ts';

export function SettingsScreen() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/organization/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/organization/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update settings.');
      }
      setMessage('Company settings & biometric parameters updated successfully.');
    } catch (err: any) {
      alert(err.message || 'Error updating settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 font-mono text-xs">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mr-3"></div>
        LOADING SYSTEM CONFIGURATION...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center space-x-2.5">
            <SettingsIcon className="w-6 h-6 text-[#00f2fe]" />
            <span>ORGANIZATION SETTINGS & BIOMETRIC POLICY</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            AUTHORITATIVE SHIFT HOURS • PKT TIMEZONE • 128D BIOMETRIC TOLERANCE
          </p>
        </div>

        <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
          ADMIN AUTHORIZED
        </span>
      </div>

      {message && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Organization Identity & Timezone */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center space-x-2 border-b border-white/10 pb-3">
            <Globe className="w-4 h-4 text-[#00f2fe]" />
            <span className="tracking-wide uppercase font-mono text-xs text-cyan-300">Organization Identity & Timezone</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-300 uppercase tracking-wider mb-1.5">
                Organization Title
              </label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs cyber-input font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-300 uppercase tracking-wider mb-1.5">
                Authoritative Timezone
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs cyber-input font-medium"
              >
                <option value="Asia/Karachi" className="bg-[#0b0e24] text-white">Asia/Karachi (PKT - UTC+05:00)</option>
                <option value="UTC" className="bg-[#0b0e24] text-white">UTC (Coordinated Universal Time)</option>
                <option value="Asia/Dubai" className="bg-[#0b0e24] text-white">Asia/Dubai (GST - UTC+04:00)</option>
                <option value="Europe/London" className="bg-[#0b0e24] text-white">Europe/London (GMT/BST)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Shift Schedule & Attendance Rules */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center space-x-2 border-b border-white/10 pb-3">
            <Clock className="w-4 h-4 text-[#7928ca]" />
            <span className="tracking-wide uppercase font-mono text-xs text-purple-300">Shift Schedule & Grace Rules</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-300 uppercase tracking-wider mb-1.5">
                Work Start Time
              </label>
              <input
                type="time"
                value={settings.workStartTime}
                onChange={(e) => setSettings({ ...settings, workStartTime: e.target.value })}
                className="w-full px-3.5 py-2 text-xs cyber-input"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-300 uppercase tracking-wider mb-1.5">
                Work End Time
              </label>
              <input
                type="time"
                value={settings.workEndTime}
                onChange={(e) => setSettings({ ...settings, workEndTime: e.target.value })}
                className="w-full px-3.5 py-2 text-xs cyber-input"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-300 uppercase tracking-wider mb-1.5">
                Grace Period (mins)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={settings.lateGraceMinutes}
                onChange={(e) => setSettings({ ...settings, lateGraceMinutes: Number(e.target.value) })}
                className="w-full px-3.5 py-2 text-xs cyber-input font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Arrivals after 09:15 marked Late</span>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-300 uppercase tracking-wider mb-1.5">
                Half-Day Min (hours)
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="8"
                value={settings.halfDayMinHours}
                onChange={(e) => setSettings({ ...settings, halfDayMinHours: Number(e.target.value) })}
                className="w-full px-3.5 py-2 text-xs cyber-input font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Under 5h logged = Half Day</span>
            </div>
          </div>
        </div>

        {/* Biometrics Policy & Matching Sliders (Inspired by Reference Image Properties Pane) */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center space-x-2">
              <ScanFace className="w-4 h-4 text-[#ff0080]" />
              <span className="tracking-wide uppercase font-mono text-xs text-pink-300">
                PROPERTIES // BIOMETRIC TOLERANCE & VAULT
              </span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400">AES-256-GCM ENCRYPTED</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Range Slider for Threshold */}
            <div className="glass-card rounded-2xl p-4 border border-white/5 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-slate-300 uppercase">Matching Threshold (Euclidean)</span>
                <span className="font-mono text-[#00f2fe] font-bold text-sm">
                  {settings.biometricPolicy.matchingThreshold}
                </span>
              </div>
              <input
                type="range"
                min="0.20"
                max="0.80"
                step="0.01"
                value={settings.biometricPolicy.matchingThreshold}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    biometricPolicy: {
                      ...settings.biometricPolicy,
                      matchingThreshold: Number(e.target.value)
                    }
                  })
                }
                className="w-full accent-[#00f2fe] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0.20 (Strict)</span>
                <span>0.45 (Optimal Standard)</span>
                <span>0.80 (Permissive)</span>
              </div>
            </div>

            {/* Template Retention Days Slider */}
            <div className="glass-card rounded-2xl p-4 border border-white/5 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-slate-300 uppercase">Vault Retention Period</span>
                <span className="font-mono text-[#ff0080] font-bold text-sm">
                  {settings.biometricPolicy.retentionDays} days
                </span>
              </div>
              <input
                type="range"
                min="30"
                max="730"
                step="30"
                value={settings.biometricPolicy.retentionDays}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    biometricPolicy: {
                      ...settings.biometricPolicy,
                      retentionDays: Number(e.target.value)
                    }
                  })
                }
                className="w-full accent-[#ff0080] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>30 Days</span>
                <span>365 Days (1 Year)</span>
                <span>730 Days (2 Years)</span>
              </div>
            </div>
          </div>

          {/* Toggle Switches styled after Reference Image SETTINGS Switches */}
          <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() =>
                  setSettings({
                    ...settings,
                    biometricPolicy: {
                      ...settings.biometricPolicy,
                      allowFallbackAttendance: !settings.biometricPolicy.allowFallbackAttendance
                    }
                  })
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.biometricPolicy.allowFallbackAttendance ? 'bg-[#00f2fe]' : 'bg-[#1a2046]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    settings.biometricPolicy.allowFallbackAttendance ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <div>
                <span className="text-xs font-semibold text-white block">Authorized Manual Fallback Attendance</span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  Permits supervisor-approved manual check-in when employee webcam is unavailable
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="glow-btn-cyan px-7 py-3 rounded-xl text-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2 shadow-lg"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'UPDATING...' : 'SAVE SYSTEM CONFIGURATION'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
