import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, setAccessToken, getAccessToken, API_BASE } from '../api/client.js';

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  cohortId?: string | null;
  isEmailVerified: boolean;
  avatarMediaId?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  unreadCount: number;
  login: (creds: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshProfile = async () => {
    try {
      if (!getAccessToken()) {
        setUser(null);
        return;
      }
      const data = await apiFetch<{ user: User }>('/users/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();

    const handleUnauthorized = () => {
      setUser(null);
      setAccessToken(null);
    };

    window.addEventListener('qelem:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('qelem:unauthorized', handleUnauthorized);
  }, []);

  // Live Server-Sent Events (SSE) listener for unread notifications and feed alerts
  useEffect(() => {
    if (!user) return;

    let eventSource: EventSource | null = null;
    let pollInterval: any = null;

    try {
      const streamUrl = `${API_BASE}/api/v1/stream?token=${getAccessToken() || ''}`;
      eventSource = new EventSource(streamUrl, { withCredentials: true });

      eventSource.addEventListener('unread', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setUnreadCount(data.count);
        } catch {}
      });

      eventSource.onerror = () => {
        // Fallback to polling every 60s if SSE connection drops
        if (!pollInterval) {
          pollInterval = setInterval(async () => {
            try {
              const res = await apiFetch<{ count: number }>('/notifications/unread-count');
              setUnreadCount(res.count);
            } catch {}
          }, 60000);
        }
      };
    } catch {
      // Direct polling fallback
      pollInterval = setInterval(async () => {
        try {
          const res = await apiFetch<{ count: number }>('/notifications/unread-count');
          setUnreadCount(res.count);
        } catch {}
      }, 60000);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [user]);

  const login = async (creds: any) => {
    const res = await apiFetch<{ user: User; accessToken: string; refreshToken?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(creds)
    });
    setAccessToken(res.accessToken, res.refreshToken);
    setUser(res.user);
  };

  const register = async (data: any) => {
    const res = await apiFetch<{ user: User; accessToken: string; refreshToken?: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    setAccessToken(res.accessToken, res.refreshToken);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {}
    setAccessToken(null, null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, unreadCount, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
