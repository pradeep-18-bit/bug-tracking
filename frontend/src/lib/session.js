export const AUTH_STORAGE_KEY = "jira_clone_session";
export const AUTH_SESSION_CLEARED_EVENT = "jira_clone_session_cleared";
const DEFAULT_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

const getStorageTargets = () => {
  if (typeof window === "undefined") {
    return [];
  }

  return [window.localStorage, window.sessionStorage].filter(Boolean);
};

const isSessionExpired = (session) => {
  const expiresAt = session?.expiresAt ? new Date(session.expiresAt).getTime() : 0;

  return Boolean(expiresAt && expiresAt <= Date.now());
};

const normalizeStoredSession = (session, { rememberMe = false } = {}) => {
  if (!session?.token) {
    return null;
  }

  return {
    ...session,
    rememberMe: Boolean(session.rememberMe ?? rememberMe),
    expiresAt:
      session.expiresAt ||
      new Date(Date.now() + DEFAULT_SESSION_MAX_AGE_MS).toISOString(),
  };
};

export const readStoredSession = () => {
  if (typeof window === "undefined") {
    return null;
  }

  for (const storage of getStorageTargets()) {
    try {
      const raw = storage.getItem(AUTH_STORAGE_KEY);
      const session = raw ? normalizeStoredSession(JSON.parse(raw)) : null;

      if (!session) {
        continue;
      }

      if (isSessionExpired(session)) {
        storage.removeItem(AUTH_STORAGE_KEY);
        continue;
      }

      return session;
    } catch (error) {
      storage.removeItem(AUTH_STORAGE_KEY);
    }
  }

  return null;
};

export const writeStoredSession = (value, options = {}) => {
  if (typeof window === "undefined") {
    return;
  }

  const rememberMe = Boolean(options.rememberMe ?? value?.rememberMe);
  const session = normalizeStoredSession(value, {
    rememberMe,
  });

  clearStoredSession();

  if (!session) {
    return;
  }

  const targetStorage = rememberMe ? window.localStorage : window.sessionStorage;
  targetStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      ...session,
      rememberMe,
    })
  );
};

export const clearStoredSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  getStorageTargets().forEach((storage) => storage.removeItem(AUTH_STORAGE_KEY));
};
