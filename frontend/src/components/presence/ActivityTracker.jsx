import { useEffect } from "react";
import { usePresence } from "@/context/PresenceContext";
import { useAuth } from "@/hooks/use-auth";

const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll"];
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 60 * 1000;

const ActivityTracker = () => {
  const { token } = useAuth();
  const { markActive, markIdle, markOffline } = usePresence();

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let idleTimerId;
    let lastActivitySentAt = 0;

    const resetIdleTimer = () => {
      window.clearTimeout(idleTimerId);
      idleTimerId = window.setTimeout(() => {
        markIdle();
      }, IDLE_TIMEOUT_MS);
    };

    const handleActivity = () => {
      const now = Date.now();

      resetIdleTimer();

      if (now - lastActivitySentAt < ACTIVITY_THROTTLE_MS) {
        return;
      }

      lastActivitySentAt = now;
      markActive();
    };

    const handlePageExit = () => {
      markOffline();
    };

    lastActivitySentAt = Date.now();
    markActive({ force: true });
    resetIdleTimer();

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    window.addEventListener("app:user-activity", handleActivity);
    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);

    return () => {
      window.clearTimeout(idleTimerId);
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      window.removeEventListener("app:user-activity", handleActivity);
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);
    };
  }, [markActive, markIdle, markOffline, token]);

  return null;
};

export default ActivityTracker;
