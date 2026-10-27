/**
 * Saylani HCM Lite - Main App Container
 * Futuristic HUD Dashboard inspired by quantum cyber interface.
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Header } from './components/Header.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { FirstRunSetupModal } from './components/FirstRunSetupModal.tsx';
import { ForcePasswordChangeModal } from './components/ForcePasswordChangeModal.tsx';
import { EmployeeAttendanceScreen } from './components/EmployeeAttendanceScreen.tsx';
import { FaceBiometricsScreen } from './components/FaceBiometricsScreen.tsx';
import { EmployeeManagementScreen } from './components/EmployeeManagementScreen.tsx';
import { AttendanceRosterScreen } from './components/AttendanceRosterScreen.tsx';
import { LeavesScreen } from './components/LeavesScreen.tsx';
import { PayrollScreen } from './components/PayrollScreen.tsx';
import { AuditLogScreen } from './components/AuditLogScreen.tsx';
import { SettingsScreen } from './components/SettingsScreen.tsx';
import { AIAssistantModal } from './components/AIAssistantModal.tsx';
import {
  Users,
  Clock,
  ScanFace,
  FileText,
  ShieldCheck,
  Settings,
  Calendar,
  UserCheck,
  ChevronRight,
  Sparkles
} from 'lucide-react';

function MainLayout() {
  const { user, isSetup, isLoading, mustChangePassword } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('attendance');
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false);

  // Set default tab based on user role when user changes
  React.useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'hr') {
      setCurrentTab('employees');
    } else {
      setCurrentTab('attendance');
    }
  }, [user?.role]);

  // Scroll back to top on tab change
  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [currentTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen cyber-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <div className="absolute inset-0 w-14 h-14 rounded-full border-2 border-magenta-500/20 border-b-[#ff0080] animate-spin [animation-duration:1.5s]" />
          </div>
          <span className="text-xs font-mono tracking-widest uppercase text-cyan-300 animate-pulse">
            INITIALIZING SAYLANI HCM CORE...
          </span>
        </div>
      </div>
    );
  }

  // First-run setup if no admin exists
  if (!isSetup) {
    return <FirstRunSetupModal />;
  }

  // Not authenticated
  if (!user) {
    return <LoginScreen />;
  }

  const role = user.role;

  // Sidebar navigation items config
  const navItems = [
    // Employee tabs
    ...(role === 'employee'
      ? [
          { id: 'attendance', label: 'My Attendance', icon: Clock },
          { id: 'leaves', label: 'Leaves & Balances', icon: Calendar },
          { id: 'payroll', label: 'My Payslips', icon: FileText },
          { id: 'biometrics', label: 'Face Biometrics', icon: ScanFace }
        ]
      : []),

    // Admin & HR shared tabs
    ...(role === 'admin' || role === 'hr'
      ? [
          { id: 'employees', label: 'Employees', icon: Users },
          { id: 'roster', label: 'Live Roster', icon: Clock },
          { id: 'fallbacks', label: 'Fallback Approvals', icon: UserCheck },
          { id: 'leaves', label: 'Leave Requests', icon: Calendar },
          { id: 'payroll', label: 'Payroll Engine', icon: FileText },
          { id: 'biometrics', label: 'Biometrics Vault', icon: ScanFace }
        ]
      : []),

    // Admin-only tabs
    ...(role === 'admin'
      ? [
          { id: 'audit', label: 'Audit Trail', icon: ShieldCheck },
          { id: 'settings', label: 'Organization Settings', icon: Settings }
        ]
      : [])
  ];

  return (
    <div className="min-h-screen cyber-bg flex flex-col font-sans text-slate-100">
      {/* Force Password Change Modal if required */}
      {mustChangePassword && <ForcePasswordChangeModal />}

      {/* Top HUD Navigation Bar */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAIModal={() => setIsAIModalOpen(true)}
      />

      {/* AI Assistant Modal */}
      <AIAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onLeaveApplied={() => setCurrentTab('leaves')}
      />

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-[1700px] mx-auto">
        {/* Left Cyber Sidebar */}
        <aside className="w-full md:w-64 shrink-0 p-3 sm:p-4 border-b md:border-b-0 md:border-r border-white/10 bg-[#080b1e]/60 backdrop-blur-xl">
          <div className="hidden md:block px-3 py-2 text-[10px] font-mono tracking-widest uppercase text-slate-400">
            SYSTEM MODULES
          </div>

          <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible py-1 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#171c42] to-[#121634] text-white border border-[#7928ca]/50 shadow-[0_0_20px_rgba(121,40,202,0.25)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#101432]/60 hover:border-white/5 border border-transparent'
                  }`}
                >
                  {/* Glowing active indicator pill */}
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-[#00f2fe] via-[#7928ca] to-[#ff0080] rounded-r-full shadow-[0_0_8px_#00f2fe]"></span>
                  )}
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-[#00f2fe]' : 'text-slate-400 group-hover:text-slate-300'
                    }`}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden md:block" />}
                </button>
              );
            })}
          </nav>

          {/* Quick AI Trigger Widget in Sidebar */}
          <div className="hidden md:block mt-6 p-3.5 rounded-2xl glass-card relative overflow-hidden border border-[#7928ca]/30">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-[#7928ca]/20 rounded-full blur-xl pointer-events-none"></div>
            <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
              <Sparkles className="w-4 h-4 text-[#00f2fe]" />
              <span>AI Assistant</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
              Ask about headcount, attendance metrics, or draft smart leaves in Roman Urdu.
            </p>
            <button
              onClick={() => setIsAIModalOpen(true)}
              className="w-full glow-btn-purple py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer"
            >
              Ask AI Assistant
            </button>
          </div>
        </aside>

        {/* Main Content Workspace Stage */}
        <main
          key={currentTab}
          className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8 overflow-y-auto"
        >
          {/* Subtitle Breadcrumb Bar */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/5">
            <div>
              <span className="text-[11px] font-mono tracking-widest uppercase text-slate-400">
                MODULE // {currentTab.toUpperCase()}
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white capitalize">
                {currentTab.replace('-', ' ')}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[#121634] border border-white/10 text-slate-300">
                ZONE: ASIA/KARACHI
              </span>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                SYSTEM HEALTHY
              </span>
            </div>
          </div>

          {/* Render Active Screen */}
          <div className="space-y-6">
            {/* Employee screens */}
            {currentTab === 'attendance' && (
              <EmployeeAttendanceScreen onGoToBiometrics={() => setCurrentTab('biometrics')} />
            )}
            {currentTab === 'biometrics' && <FaceBiometricsScreen />}

            {/* Admin & HR screens */}
            {currentTab === 'employees' && <EmployeeManagementScreen />}
            {currentTab === 'roster' && <AttendanceRosterScreen initialSubTab="roster" />}
            {currentTab === 'fallbacks' && <AttendanceRosterScreen initialSubTab="fallbacks" />}

            {/* Shared modules */}
            {currentTab === 'leaves' && <LeavesScreen />}
            {currentTab === 'payroll' && <PayrollScreen />}

            {/* Admin only */}
            {currentTab === 'audit' && <AuditLogScreen />}
            {currentTab === 'settings' && <SettingsScreen />}
          </div>
        </main>
      </div>

      {/* Cyber Footer */}
      <footer className="border-t border-white/10 bg-[#060814]/80 py-3 px-4 text-center text-xs text-slate-400 backdrop-blur-md">
        <span className="font-semibold text-slate-300">Saylani HCM Lite HUD</span>
        <span className="hidden sm:inline"> | Enterprise Human Capital Management | Saylani Welfare International Trust</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
