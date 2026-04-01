import { createContext, useMemo, useState } from "react";
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from "@/lib/session";
import { getDashboardPathByRole } from "@/lib/roles";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(() => readStoredSession());

  const setAuthSession = (value) => {
    setSession(value);
    writeStoredSession(value);
  };

  const logout = () => {
    setSession(null);
    clearStoredSession();
  };

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
