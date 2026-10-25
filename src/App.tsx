/**
 * Saylani HCM Lite - Main App Container
 * Production-Quality Human Capital Management System with Face Verification & Automatic Attendance.
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

function MainLayout() {
  const { user, isSetup, isLoading, mustChangePassword } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('attendance');

  // Set default tab based on user role when user changes
  React.useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'hr') {
      setCurrentTab('employees');
    } else {
      setCurrentTab('attendance');
    }
  }, [user?.role]);

  // Scroll back to the top whenever the person opens another screen
  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [currentTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
          <div className="w-9 h-9 border-[3px] border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-600">Loading Saylani HCM Lite</span>
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Force Password Change Modal if required */}
      {mustChangePassword && <ForcePasswordChangeModal />}

      {/* Main Header & Role Navigation */}
      <Header currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Main Workspace Body. The key restarts a short fade when the screen changes */}
      <main
        key={currentTab}
        className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 animate-screen-in"
      >
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
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        <span className="font-medium text-slate-700">Saylani HCM Lite</span>
        <span className="hidden sm:inline"> | Saylani Welfare International Trust</span>
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
