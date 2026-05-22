import { createContext, useEffect, useMemo, useState } from "react";
import {
  AUTH_SESSION_CLEARED_EVENT,
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from "@/lib/session";
import { getDashboardPathByRole } from "@/lib/roles";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(() => readStoredSession());

  const setAuthSession = (value, options = {}) => {
    setSession(value);
    writeStoredSession(value, options);
  };

  const logout = () => {
    setSession(null);
    clearStoredSession();
  };

  useEffect(() => {
    const handleSessionCleared = () => setSession(null);

    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, handleSessionCleared);

    return () => {
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, handleSessionCleared);
    };
  }, []);

  const value = useMemo(
    () => ({
      token: session?.token || null,
      user: session?.user || null,
      role: session?.user?.role || null,
      dashboardPath: getDashboardPathByRole(session?.user?.role),
      isAuthenticated: Boolean(session?.token),
      setAuthSession,
      logout,
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
