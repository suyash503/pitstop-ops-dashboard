'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, AUTH_EXPIRED_EVENT, tokenStore } from './api';
import type { AuthUser } from './types';

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');

  // On boot, trade any stored token for the user it represents. This also
  // validates it — a token the API no longer accepts is cleared here rather
  // than failing on the first data request.
  useEffect(() => {
    let cancelled = false;

    // Wrapped in an async function so the state updates land in a callback
    // rather than synchronously in the effect body, which would cascade an
    // extra render on every mount.
    void (async () => {
      const stored = tokenStore.get();
      if (!stored) {
        if (!cancelled) setStatus('anonymous');
        return;
      }

      try {
        const me = await api.me();
        if (cancelled) return;
        setUser(me);
        setToken(stored);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        tokenStore.clear();
        setStatus('anonymous');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // A 401 from anywhere in the app unwinds the session exactly once.
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setToken(null);
      setStatus('anonymous');
      router.replace('/login');
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    tokenStore.set(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setToken(null);
    setStatus('anonymous');
    router.replace('/login');
  }, [router]);

  const value = useMemo<AuthState>(
    () => ({ user, token, status, login, logout, isAdmin: user?.role === 'ADMIN' }),
    [user, token, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
