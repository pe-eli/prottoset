import { api } from '../../lib/axios';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface RegisterResponse {
  message: string;
}

export interface CsrfResponse {
  csrfToken: string;
}

export const authAPI = {
  csrf: () => api.get<CsrfResponse>('/auth/csrf'),

  register: (email: string, password: string, name: string, captchaToken: string) =>
    api.post<RegisterResponse>('/auth/register', { email, password, name, captchaToken }),

  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),

  logout: () => api.post('/auth/logout'),

  me: () => api.get<AuthResponse>('/auth/me'),

  refresh: () => api.post<AuthResponse>('/auth/refresh'),

  googleLogin: () => {
    const base = import.meta.env.VITE_API_URL ?? '/api';
    window.location.href = `${base}/auth/google`;
  },
};
