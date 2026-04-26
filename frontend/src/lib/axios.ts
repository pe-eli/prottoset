import axios from 'axios';

function resolveApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_URL ?? '/api').trim();

  // In browser, force same-origin API path when configured URL is cross-origin.
  // This keeps auth cookies first-party on mobile browsers.
  if (typeof window !== 'undefined') {
    if (!configured || configured.startsWith('/')) return configured || '/api';

    try {
      const parsed = new URL(configured);
      if (parsed.origin !== window.location.origin) {
        return '/api';
      }
      const normalizedPath = parsed.pathname.replace(/\/$/, '');
      return normalizedPath || '/api';
    } catch {
      return '/api';
    }
  }

  return configured || '/api';
}

export const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
});

const csrfClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
  },
});

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

async function fetchCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }
  if (!csrfRequest) {
    csrfRequest = csrfClient.get<{ csrfToken: string }>('/auth/csrf')
      .then(({ data }) => {
        csrfToken = data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfRequest = null;
      });
  }
  return csrfRequest;
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    const token = await fetchCsrfToken();
    config.headers = config.headers || {};
    config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

let isRefreshing = false;
let refreshBlockedUntil = 0;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];
let consecutiveRefreshFailures = 0;

function processQueue(error: unknown) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(undefined);
  });
  failedQueue = [];
}

export function resetApiSessionState(): void {
  csrfToken = null;
  csrfRequest = null;
  isRefreshing = false;
  refreshBlockedUntil = 0;
  processQueue(new Error('Session state reset'));
}

api.interceptors.response.use(
  (response) => {
    // Reset consecutive failures on success
    consecutiveRefreshFailures = 0;
    return response;
  },
  async (error) => {
    const original = error.config;

    // Paywall: subscription required or limit exceeded
    if (error.response?.status === 402) {
      window.dispatchEvent(new CustomEvent('subscription:paywall', {
        detail: { code: error.response.data?.code || 'subscription_required' },
      }));
      return Promise.reject(error);
    }

    if (error.response?.status === 403 && typeof error.response?.data?.error === 'string' && error.response.data.error.includes('CSRF')) {
      csrfToken = null;
    }

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/logout') &&
      !original.url?.includes('/auth/register') &&
      !original.url?.includes('/auth/verify-code') &&
      !original.url?.includes('/auth/resend-code') &&
      !original.url?.includes('/auth/check-email')
    ) {
      if (Date.now() < refreshBlockedUntil) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(original));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        csrfToken = null;
        consecutiveRefreshFailures = 0;
        await api.post('/auth/refresh');
        processQueue(null);
        return api(original);
      } catch (refreshError) {
        consecutiveRefreshFailures++;
        const status = (refreshError as { response?: { status?: number } })?.response?.status;
        
        if (status === 401) {
          // Only block after multiple failures (for mobile resilience)
          if (consecutiveRefreshFailures >= 2) {
            refreshBlockedUntil = Date.now() + 60_000;
            window.dispatchEvent(new CustomEvent('auth:session-expired', {
              detail: {
                reason: (refreshError as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Sessão expirada',
              },
            }));
          } else {
            // First failure: add exponential backoff for mobile cookie settling
            const backoffMs = Math.pow(2, consecutiveRefreshFailures - 1) * 100;
            refreshBlockedUntil = Date.now() + backoffMs;
          }
        }
        processQueue(refreshError);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
