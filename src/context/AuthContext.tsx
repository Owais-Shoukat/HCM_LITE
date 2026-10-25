import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Employee } from '../types/index.ts';

interface AuthContextType {
  user: User | null;
  employee: Employee | null;
  token: string | null;
  isSetup: boolean;
  isLoading: boolean;
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<void>;
  setupAdmin: (fullName: string, email: string, password: string) => Promise<void>;
  activateAccount: (token: string, newPassword: string) => Promise<void>;
  changePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('saylani_hcm_token'));
  const [isSetup, setIsSetup] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);

  // Check setup status
  const checkSetupStatus = async () => {
    try {
      const res = await fetch('/api/auth/setup-status');
      const data = await res.json();
      setIsSetup(Boolean(data.isSetup));
    } catch (err) {
      console.error('Failed to check setup status:', err);
    }
  };

  // Fetch current user details if token exists
  const fetchMe = async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setEmployee(data.employee);
        setMustChangePassword(Boolean(data.mustChangePassword));
      } else {
        // Token invalid or expired
        logout();
      }
    } catch (err) {
      console.error('Error fetching auth user:', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkSetupStatus();
    if (token) {
      fetchMe(token);
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed.');
    }

    localStorage.setItem('saylani_hcm_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setEmployee(data.employee);
    setMustChangePassword(Boolean(data.mustChangePassword));
  };

  const setupAdmin = async (fullName: string, email: string, password: string) => {
    const res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'System setup failed.');
    }

    localStorage.setItem('saylani_hcm_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setIsSetup(true);
    setMustChangePassword(false);
  };

  const activateAccount = async (activationToken: string, newPassword: string) => {
    const res = await fetch('/api/auth/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: activationToken, newPassword })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Account activation failed.');
    }

    localStorage.setItem('saylani_hcm_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setMustChangePassword(false);
    await fetchMe(data.token);
  };

  const changePassword = async (newPassword: string, currentPassword?: string) => {
    if (!token) throw new Error('Not authenticated.');

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ newPassword, currentPassword })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update password.');
    }

    setMustChangePassword(false);
  };

  const logout = () => {
    localStorage.removeItem('saylani_hcm_token');
    setToken(null);
    setUser(null);
    setEmployee(null);
    setMustChangePassword(false);
  };

  const refreshMe = async () => {
    if (token) {
      await fetchMe(token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        employee,
        token,
        isSetup,
        isLoading,
        mustChangePassword,
        login,
        setupAdmin,
        activateAccount,
        changePassword,
        logout,
        refreshMe
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
