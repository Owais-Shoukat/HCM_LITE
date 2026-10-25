import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Users,
  Clock,
  ScanFace,
  FileText,
  ShieldCheck,
  Settings,
  LogOut,
  UserCheck,
  Building2,
  Calendar
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export function Header({ currentTab, onSelectTab }: HeaderProps) {
  const { user, employee, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format in company timezone (PKT / Asia/Karachi)
      const formatter = new Intl.DateTimeFormat('en-PK', {
        timeZone: 'Asia/Karachi',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      setCurrentTime(formatter.format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const role = user?.role || 'employee';

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">Saylani HCM Lite</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400">Enterprise AI Human Capital Management</p>
            </div>
          </div>

          {/* Right Side: Live Server Time & User Badge */}
          <div className="flex items-center space-x-4">
            {/* Live Clock */}
            <div className="hidden md:flex items-center space-x-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>PKT (Karachi): <strong className="text-white font-mono">{currentTime}</strong></span>
            </div>

            {/* User Profile & Role */}
            <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-slate-100">{user?.fullName}</div>
                <div className="flex items-center justify-end space-x-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.2 rounded-full border ${
                    role === 'admin'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : role === 'hr'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {role}
                  </span>
                  {employee?.employeeCode && (
                    <span className="text-xs text-slate-400 font-mono">({employee.employeeCode})</span>
                  )}
                </div>
              </div>

              <button
                onClick={logout}
                title="Sign Out"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      
      {/* Navigation Tabs */}
      <div className="bg-slate-950/80 border-t border-slate-800/60">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
          <nav className="flex w-full min-w-0 gap-1 overflow-x-auto overflow-y-hidden py-2 scrollbar-none">
            {/* EMPLOYEE TABS */}
            {role === 'employee' && (
              <>
                <button
                  onClick={() => onSelectTab('attendance')}
                  className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'attendance'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>My Attendance &amp; Punch</span>
                </button>

                <button
                  onClick={() => onSelectTab('biometrics')}
                  className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'biometrics'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <ScanFace className="w-4 h-4" />
                  <span>Face Biometrics Vault</span>
                  {employee?.faceEnrolled ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  ) : (
                    <span className="text-[10px] bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded-full font-bold">
                      Action Needed
                    </span>
                  )}
                </button>

                <button
                  onClick={() => onSelectTab('leaves')}
                  className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'leaves'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>My Leaves</span>
                </button>
              </>
            )}

            {/* ADMIN & HR TABS */}
            {(role === 'admin' || role === 'hr') && (
              <>
                <button
                  onClick={() => onSelectTab('employees')}
                  className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'employees'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Employees &amp; Accounts</span>
                </button>

                <button
                  onClick={() => onSelectTab('roster')}
                  className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'roster'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Live Attendance Board</span>
                </button>

                <button
                  onClick={() => onSelectTab('fallbacks')}
                  className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'fallbacks'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Fallback Approvals</span>
                </button>

                <button
                  onClick={() => onSelectTab('leaves')}
                  className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'leaves'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Leave Applications</span>
                </button>

                <button
                  onClick={() => onSelectTab('payroll')}
                  className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'payroll'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Payroll Lite</span>
                </button>
              </>
            )}

            {/* ADMIN ONLY TABS */}
            {role === 'admin' && (
              <>
                <button
                  onClick={() => onSelectTab('audit')}
                  className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'audit'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Security &amp; Audit Logs</span>
                </button>

                <button
                  onClick={() => onSelectTab('settings')}
                  className={`flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    currentTab === 'settings'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>Company Settings</span>
                </button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}