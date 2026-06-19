import { useEffect } from "react";
import { usePresence } from "@/context/PresenceContext";

const ActivityTracker = () => {
  const { markActive } = usePresence();

  useEffect(() => {
    markActive({ force: true });
  }, [markActive]);

  return null;
};

export default ActivityTracker;
