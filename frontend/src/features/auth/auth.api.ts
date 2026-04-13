import { api } from '../../lib/axios';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailVerified?: boolean;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface RegisterResponse {
  message: string;
  email?: string;
  verificationId?: string;
}

export interface CsrfResponse {
  csrfToken: string;
}

export const authAPI = {
  csrf: () => api.get<CsrfResponse>('/auth/csrf'),

  register: (email: string, password: string, name: string, acceptedTerms: boolean) =>
    api.post<RegisterResponse>('/auth/register', { email, password, name, acceptedTerms }),

  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),

  verifyCode: (email: string, code: string, verificationId: string) =>
    api.post<RegisterResponse>('/auth/verify-code', { email, code, verificationId }),

  resendCode: (email: string) =>
    api.post<RegisterResponse>('/auth/resend-code', { email }),

  logout: () => api.post('/auth/logout'),

  me: () => api.get<AuthResponse>('/auth/me'),

  refresh: () => api.post<AuthResponse>('/auth/refresh'),

  googleLogin: () => {
    const base = import.meta.env.VITE_API_URL ?? '/api';
    window.location.href = `${base}/auth/google`;
  },
};
