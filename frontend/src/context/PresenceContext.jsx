import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { getChatSocket } from "@/lib/socket";

const PresenceContext = createContext(null);
const ACTIVE_THROTTLE_MS = 45000;
const IDLE_MS = 5 * 60 * 1000;
const AWAY_MS = 15 * 60 * 1000;

const getId = (value) => String(value?._id || value?.id || value || "");

export const PresenceProvider = ({ children }) => {
  const { token, user } = useAuth();
  const location = useLocation();
  const [presenceByUserId, setPresenceByUserId] = useState({});
  const currentStatusRef = useRef("offline");
  const lastEmitRef = useRef(0);
  const idleTimerRef = useRef(null);
  const awayTimerRef = useRef(null);

  const upsertPresence = useCallback((presence) => {
    const userId = getId(presence?.userId);

    if (!userId) {
      return;
    }

    setPresenceByUserId((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        ...presence,
        userId,
      },
    }));
  }, []);

  const emitStatus = useCallback(
    (status, options = {}) => {
      if (!token) return;
      const socket = getChatSocket(token);

      if (!socket) return;

      const now = Date.now();
      const shouldThrottle =
        status === "active" &&
        !options.force &&
        currentStatusRef.current === "active" &&
        now - lastEmitRef.current < ACTIVE_THROTTLE_MS;

      if (shouldThrottle) {
        return;
      }

      currentStatusRef.current = status;
      lastEmitRef.current = now;

      if (!socket.connected) {
        socket.connect();
      }

      socket.emit(`user:${status}`, {
        at: new Date(now).toISOString(),
      });
    },
    [token]
  );

  const scheduleIdleTimers = useCallback(() => {
    window.clearTimeout(idleTimerRef.current);
    window.clearTimeout(awayTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => emitStatus("idle", { force: true }), IDLE_MS);
    awayTimerRef.current = window.setTimeout(() => emitStatus("away", { force: true }), AWAY_MS);
  }, [emitStatus]);

  const markActive = useCallback(
    (options = {}) => {
      emitStatus("active", options);
      scheduleIdleTimers();
    },
    [emitStatus, scheduleIdleTimers]
  );

  useEffect(() => {
    if (!token) {
      setPresenceByUserId({});
      return undefined;
    }

    const socket = getChatSocket(token);
    if (!socket) return undefined;

    const handlePresenceUpdate = (presence) => upsertPresence(presence);
    const handleConnect = () => markActive({ force: true });

    socket.on("presence:update", handlePresenceUpdate);
    socket.on("connect", handleConnect);
    socket.connect();
    markActive({ force: true });

    return () => {
      socket.off("presence:update", handlePresenceUpdate);
      socket.off("connect", handleConnect);
      window.clearTimeout(idleTimerRef.current);
      window.clearTimeout(awayTimerRef.current);
    };
  }, [markActive, token, upsertPresence]);

  useEffect(() => {
    if (!token) return undefined;

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    const handleActivity = () => markActive();

    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, handleActivity, { passive: true })
    );
    window.addEventListener("app:user-activity", handleActivity);
    scheduleIdleTimers();

    return () => {
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, handleActivity)
      );
      window.removeEventListener("app:user-activity", handleActivity);
    };
  }, [markActive, scheduleIdleTimers, token]);

  useEffect(() => {
    markActive();
  }, [location.pathname, location.search, markActive]);

  useEffect(() => {
    const userId = getId(user);

    if (!userId) return;

    upsertPresence({
      userId,
      status: currentStatusRef.current === "offline" ? "active" : currentStatusRef.current,
      lastSeen: new Date().toISOString(),
    });
  }, [upsertPresence, user]);

  const value = useMemo(
    () => ({
      markActive,
      presenceByUserId,
      getPresence: (userId) =>
        presenceByUserId[getId(userId)] || {
          userId: getId(userId),
          status: "offline",
          lastSeen: null,
        },
    }),
    [markActive, presenceByUserId]
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
};

export const usePresence = () =>
  useContext(PresenceContext) || {
    markActive: () => {},
    presenceByUserId: {},
    getPresence: () => ({ status: "offline", lastSeen: null }),
  };
