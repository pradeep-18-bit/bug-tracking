import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import { Skeleton } from "@/components/ui/skeleton";
import useScrollRestoration from "@/hooks/use-scroll-restoration";

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
  useScrollRestoration();

  return (
    <div className="relative min-h-screen bg-transparent text-gray-900">
      <Navbar />
      <main className="mt-4 px-4 pb-10 pt-20 sm:px-6 lg:px-8">
        <Suspense fallback={<RouteContentFallback />}>
          <div key={`${location.pathname}${location.search}`} className="page-shell-enter">
            <Outlet />
          </div>
        </Suspense>
      </main>
    </div>
  );
};

export default AppShell;
