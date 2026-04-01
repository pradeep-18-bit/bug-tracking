import { cn } from "@/lib/utils";

const Skeleton = ({ className, ...props }) => (
  <div
    className={cn("animate-pulse rounded-2xl bg-gray-200/80", className)}
    {...props}
  />
);

export { Skeleton };
