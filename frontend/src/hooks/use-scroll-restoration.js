import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const STORAGE_KEY = "workspace-scroll-positions";
const scrollPositions = new Map();
let hasHydrated = false;

const buildLocationKey = (pathname, search = "") => `${pathname}${search}`;

const hydrateScrollPositions = () => {
  if (hasHydrated || typeof window === "undefined") {
    return;
  }

  hasHydrated = true;

  try {
    const rawValue = window.sessionStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return;
    }

    const parsedValue = JSON.parse(rawValue);

    Object.entries(parsedValue).forEach(([key, value]) => {
      if (typeof value === "number") {
        scrollPositions.set(key, value);
      }
    });
  } catch (error) {
    scrollPositions.clear();
  }
};

const persistScrollPositions = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(scrollPositions.entries()))
    );
  } catch (error) {
    // If session storage is unavailable, in-memory restoration still works.
  }
};

const saveScrollPosition = (locationKey) => {
  if (typeof window === "undefined" || !locationKey) {
    return;
  }

  scrollPositions.set(locationKey, window.scrollY);
  persistScrollPositions();
};

const useScrollRestoration = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousLocationKeyRef = useRef("");
  const hasMountedRef = useRef(false);

  useLayoutEffect(() => {
    hydrateScrollPositions();

    if (typeof window === "undefined") {
      return undefined;
    }

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const currentLocationKey = buildLocationKey(
      location.pathname,
      location.search
    );
    const previousLocationKey = previousLocationKeyRef.current;
    const isInitialRender = !hasMountedRef.current;

    if (previousLocationKey) {
      saveScrollPosition(previousLocationKey);
    }

    const shouldRestoreSavedPosition =
      !isInitialRender &&
      navigationType === "POP" &&
      scrollPositions.has(currentLocationKey);
    const nextScrollPosition = shouldRestoreSavedPosition
      ? scrollPositions.get(currentLocationKey) ?? 0
      : 0;
    const animationFrame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: nextScrollPosition, left: 0 });
    });

    previousLocationKeyRef.current = currentLocationKey;
    hasMountedRef.current = true;

    return () => {
      window.cancelAnimationFrame(animationFrame);
      saveScrollPosition(currentLocationKey);
    };
  }, [location.pathname, location.search, navigationType]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const currentLocationKey = buildLocationKey(
      location.pathname,
      location.search
    );
    const handlePageHide = () => {
      saveScrollPosition(currentLocationKey);
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [location.pathname, location.search]);
};

export default useScrollRestoration;
