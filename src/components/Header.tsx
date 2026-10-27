import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Clock,
  LogOut,
  Building2,
  Bot,
  Bell,
  Sparkles,
  Shield,
  UserCheck
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAIModal?: () => void;
}

export function Header({ currentTab, onSelectTab, onOpenAIModal }: HeaderProps) {
  const { user, employee, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
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
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#080a1c]/80 border-b border-white/10 shadow-lg shadow-black/40">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Project Identity */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="relative group cursor-pointer">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#7928ca] to-[#00f2fe] rounded-xl blur-sm opacity-70 group-hover:opacity-100 transition duration-300"></div>
              <div className="relative w-10 h-10 rounded-xl bg-[#0d1028] border border-white/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[#00f2fe]" />
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base sm:text-lg tracking-wider text-white">
                  SAYLANI <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f2fe] via-[#7928ca] to-[#ff0080]">HCM LITE</span>
                </span>
                <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold tracking-widest uppercase">
                  v2.0 HUD
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 hidden sm:block tracking-wide">
                WORKSPACE: <span className="text-slate-300 font-medium">Saylani Trust // Core</span>
              </p>
            </div>
          </div>

          {/* Action Center & Right Controls */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Live PKT Clock Pill */}
            <div className="hidden md:flex items-center space-x-2 text-xs bg-[#121635]/80 px-3 py-1.5 rounded-full border border-white/10 text-slate-300 shadow-inner">
              <Clock className="w-3.5 h-3.5 text-[#00f2fe] animate-pulse" />
              <span>PKT (Karachi): <strong className="text-white font-mono">{currentTime}</strong></span>
            </div>

            {/* AI Assistant Futuristic Glow Button */}
            {onOpenAIModal && (
              <button
                onClick={onOpenAIModal}
                className="glow-btn-magenta flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs cursor-pointer shadow-md"
                title="Launch HCM AI Assistant"
              >
                <Bot className="w-4 h-4 text-white animate-bounce" />
                <span className="hidden sm:inline tracking-wide uppercase font-bold text-[11px]">AI ASSISTANT</span>
              </button>
            )}

            {/* Notifications Pill */}
            <div className="relative p-2 rounded-full bg-[#121635]/60 border border-white/10 text-slate-400 hover:text-white cursor-pointer transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#ff0080] shadow-[0_0_8px_#ff0080]"></span>
            </div>

            {/* User Profile Capsule */}
            <div className="flex items-center space-x-3 pl-2 sm:pl-3 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-white tracking-wide">{user?.fullName}</div>
                <div className="flex items-center justify-end space-x-1.5">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                      role === 'admin'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        : role === 'hr'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                    }`}
                  >
                    {role}
                  </span>
                  {employee?.employeeCode && (
                    <span className="text-[10px] text-slate-400 font-mono">[{employee.employeeCode}]</span>
                  )}
                </div>
              </div>

              {/* Avatar Icon */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7928ca] to-[#00f2fe] p-[1.5px] flex items-center justify-center">
                <div className="w-full h-full bg-[#080a1c] rounded-full flex items-center justify-center text-xs font-bold text-white uppercase">
                  {user?.fullName?.charAt(0) || 'U'}
                </div>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={logout}
                title="Sign Out"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
