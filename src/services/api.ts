/**
 * Saylani HCM Lite - Frontend API Client
 * Provides centralized fetch wrapper with automatic JWT header injection,
 * token retrieval from localStorage ('saylani_hcm_token'), and consistent error handling.
 */

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('saylani_hcm_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('saylani_hcm_token', token);
}

export function removeAuthToken() {
  localStorage.removeItem('saylani_hcm_token');
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    (headers as any)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    const error: any = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
