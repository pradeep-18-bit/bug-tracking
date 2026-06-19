import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CallProvider } from "@/components/chat/CallProvider";
import ChatRealtimeBridge from "@/components/chat/ChatRealtimeBridge";
import Navbar from "@/components/layout/Navbar";
import ActivityTracker from "@/components/presence/ActivityTracker";
import { Skeleton } from "@/components/ui/skeleton";
import { PresenceProvider } from "@/context/PresenceContext";
import { useBugWorkflowRealtime } from "@/hooks/useBugWorkflowRealtime";
import useScrollRestoration from "@/hooks/use-scroll-restoration";
import { cn } from "@/lib/utils";

const RouteContentFallback = () => (
  <div className="space-y-5">
    <Skeleton className="h-[180px] w-full rounded-[32px]" />
    <div className="grid gap-4 md:grid-cols-2">
      <Skeleton className="h-[260px] w-full rounded-[32px]" />
      <Skeleton className="h-[260px] w-full rounded-[32px]" />
    </div>
    <Skeleton className="h-[320px] w-full rounded-[32px]" />
  </div>
);

const AppShell = () => {
  const location = useLocation();
  const isChatPage = location.pathname === "/chat";
  useBugWorkflowRealtime();
  useScrollRestoration();

  useEffect(() => {
    if (isChatPage) {
      document.documentElement.style.height = "100%";
      document.documentElement.style.overflow = "hidden";
      document.body.style.height = "100%";
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.documentElement.style.height = "";
      document.documentElement.style.overflow = "";
      document.body.style.height = "";
      document.body.style.overflow = "";
    };
  }, [isChatPage]);

  return (
    <div
      className={cn(
        "relative h-full overflow-hidden bg-transparent text-gray-900"
      )}
    >
      <PresenceProvider>
        <ActivityTracker />
        <CallProvider>
          <ChatRealtimeBridge />
          <Navbar />
          <main
            className={cn(
              "app-main-content",
              isChatPage ? "overflow-hidden pb-0" : "overflow-y-auto pb-6"
            )}
          >
            <Suspense fallback={<RouteContentFallback />}>
              <div
                key={`${location.pathname}${location.search}`}
                className={cn(
                  "page-shell-enter w-full",
                  isChatPage ? "h-full overflow-hidden" : "min-h-full"
                )}
              >
                <Outlet />
              </div>
            </Suspense>
          </main>
        </CallProvider>
      </PresenceProvider>
    </div>
  );
};

export default AppShell;
