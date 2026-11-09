export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

let accessToken: string | null = localStorage.getItem('qelem_access_token');
let refreshToken: string | null = localStorage.getItem('qelem_refresh_token');

export function setAccessToken(token: string | null, refresh?: string | null) {
  accessToken = token;
  if (token) {
    localStorage.setItem('qelem_access_token', token);
  } else {
    localStorage.removeItem('qelem_access_token');
  }

  if (refresh !== undefined) {
    refreshToken = refresh;
    if (refresh) {
      localStorage.setItem('qelem_refresh_token', refresh);
    } else {
      localStorage.removeItem('qelem_refresh_token');
    }
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE}/api/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const fetchOptions: RequestInit = {
    ...options,
    credentials: options.credentials || 'include',
    headers
  };

  let response = await fetch(url, fetchOptions);

  // Handle 401: attempt transparent session refresh
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        headers['Authorization'] = `Bearer ${newToken}`;
        return fetch(url, { ...fetchOptions, headers }).then((r) => r.json());
      });
    }

    isRefreshing = true;

    try {
      const storedRefresh = getRefreshToken();
      const refreshRes = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken: storedRefresh })
      });

      if (!refreshRes.ok) {
        setAccessToken(null, null);
        window.dispatchEvent(new Event('qelem:unauthorized'));
        throw new ApiError(401, 'Session expired. Please log in again.');
      }

      const refreshData = await refreshRes.json();
      setAccessToken(refreshData.accessToken, refreshData.refreshToken);
      processQueue(null, refreshData.accessToken);

      headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
      response = await fetch(url, { ...fetchOptions, headers });
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      throw refreshErr;
    } finally {
      isRefreshing = false;
    }
  }

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }
    throw new ApiError(response.status, errorData.detail || errorData.title || 'Request failed', errorData);
  }

  return response.json();
}
