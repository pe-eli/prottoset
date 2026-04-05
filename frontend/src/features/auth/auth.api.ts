import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
});

export interface AuthMeResponse {
  authenticated: boolean;
  username: string;
}

export const authAPI = {
  login: (username: string, password: string) =>
    api.post<AuthMeResponse>('/auth/login', { username, password }),

  logout: () => api.post('/auth/logout'),

  me: () => api.get<AuthMeResponse>('/auth/me'),
};
