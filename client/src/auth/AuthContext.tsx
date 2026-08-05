import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PermissionCode, UserRole } from "@chuying/shared";
import { ApiError, api } from "../api/client";

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  displayName: string;
  status: string;
  permissions?: PermissionCode[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthUser>;
  demoLogin: (role: UserRole) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchWithRetry(path: string): Promise<{ user: AuthUser }> {
  const delays = [500, 1000, 2000];
  let lastError: unknown = null;

  for (let i = 0; i <= delays.length; i++) {
    try {
      return await api<{ user: AuthUser }>(path);
    } catch (err) {
      lastError = err;
      // Only retry on network/transient errors, never on 401
      if (err instanceof ApiError && err.status === 401) {
        throw err;
      }
      if (i < delays.length) {
        await new Promise((r) => setTimeout(r, delays[i]));
      }
    }
  }
  throw lastError;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchWithRetry("/api/auth/me");
      if (mountedRef.current) {
        setUser(data.user);
      }
    } catch (err) {
      // Only clear user on explicit 401 (not logged in)
      if (err instanceof ApiError && err.status === 401) {
        if (mountedRef.current) setUser(null);
      }
      // On network/transient errors, keep current state (may be null on first load,
      // but the loading indicator and retry on focus give recovery paths)
    }
  }, []);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [refresh]);

  // Refresh on window focus to pick up data changes from other tabs / admin actions
  useEffect(() => {
    function onFocus() {
      void refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (mountedRef.current) setUser(data.user);
    return data.user;
  }, []);

  const demoLogin = useCallback(async (role: UserRole) => {
    const data = await api<{ user: AuthUser }>("/api/auth/demo-login", {
      method: "POST",
      body: JSON.stringify({ role }),
    });
    if (mountedRef.current) setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    if (mountedRef.current) setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, login, demoLogin, logout }),
    [user, loading, refresh, login, demoLogin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
