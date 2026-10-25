import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Settings, Save, Clock, ScanFace, Globe, Shield } from 'lucide-react';
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
      setMessage('Company settings and biometric policy updated successfully.');
    } catch (err: any) {
      alert(err.message || 'Error updating settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return <div className="text-center py-12 text-slate-400">Loading settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Settings className="w-6 h-6 text-emerald-600" />
            <span>Company & Biometric Policy Configuration</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure authoritative shift hours, company timezone, lateness thresholds, and facial matching tolerance.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold">
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Organization & Timezone */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
            <Globe className="w-4 h-4 text-emerald-600" />
            <span>Company Identity & Timezone</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Organization Name
              </label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Company Timezone (IANA)
              </label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="Asia/Karachi">Asia/Karachi (PKT - UTC+05:00)</option>
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST - UTC+04:00)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Shift & Lateness Policy */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Shift Schedule & Attendance Rules</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Work Start Time
              </label>
              <input
                type="time"
                value={settings.workStartTime}
                onChange={(e) => setSettings({ ...settings, workStartTime: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Work End Time
              </label>
              <input
                type="time"
                value={settings.workEndTime}
                onChange={(e) => setSettings({ ...settings, workEndTime: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Late Grace Period (mins)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={settings.lateGraceMinutes}
                onChange={(e) => setSettings({ ...settings, lateGraceMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Half-Day Min (hours)
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="8"
                value={settings.halfDayMinHours}
                onChange={(e) => setSettings({ ...settings, halfDayMinHours: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Biometrics Policy */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
            <ScanFace className="w-4 h-4 text-emerald-600" />
            <span>Biometric Attendance Policy & Matching Threshold</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Matching Threshold (Euclidean Dist)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.2"
                max="0.8"
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
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Standard: 0.45 (lower = stricter match)
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Template Retention (days)
              </label>
              <input
                type="number"
                min="30"
                max="730"
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
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Authorized Fallback Attendance
              </label>
              <div className="mt-2">
                <label className="inline-flex items-center space-x-2 cursor-pointer text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={settings.biometricPolicy.allowFallbackAttendance}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        biometricPolicy: {
                          ...settings.biometricPolicy,
                          allowFallbackAttendance: e.target.checked
                        }
                      })
                    }
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span>Allow Manual Fallback with HR Audit</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
