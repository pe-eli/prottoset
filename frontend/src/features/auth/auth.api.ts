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

export interface CheckEmailResponse {
  exists: boolean;
  emailVerified: boolean;
}

export const authAPI = {
  csrf: () => api.get<CsrfResponse>('/auth/csrf'),

  checkEmail: (email: string) =>
    api.get<CheckEmailResponse>('/auth/check-email', { params: { email } }),

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

  googleLogin: (returnTo?: string) => {
    const base = import.meta.env.VITE_API_URL ?? '/api';
    const target = returnTo
      ? `${base}/auth/google?returnTo=${encodeURIComponent(returnTo)}`
      : `${base}/auth/google`;
    window.location.assign(target);
  },
};
