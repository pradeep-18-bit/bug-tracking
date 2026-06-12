import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import ChatRealtimeBridge from "@/components/chat/ChatRealtimeBridge";
import Navbar from "@/components/layout/Navbar";
import { Skeleton } from "@/components/ui/skeleton";
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

  return (
    <div
      className={cn(
        "relative bg-transparent text-gray-900",
        isChatPage ? "h-screen overflow-hidden" : "min-h-screen"
      )}
    >
      <ChatRealtimeBridge />
      <Navbar />
      <main
        className={cn(
          isChatPage
            ? "h-full overflow-hidden pt-16"
            : "mt-4 px-4 pb-10 pt-16 sm:px-6 sm:pt-20 lg:px-8"
        )}
      >
        <Suspense fallback={<RouteContentFallback />}>
          <div
            key={`${location.pathname}${location.search}`}
            className={cn("page-shell-enter", isChatPage && "h-full overflow-hidden")}
          >
            <Outlet />
          </div>
        </Suspense>
      </main>
    </div>
  );
};

export default AppShell;
