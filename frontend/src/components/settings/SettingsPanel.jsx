import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SettingsPanel = ({
  actions = null,
  children,
  className,
  contentClassName,
  description,
  headerClassName,
  title,
}) => (
  <Card
    className={cn(
      "overflow-hidden rounded-[16px] border-slate-200/90 bg-white shadow-[0_18px_48px_-36px_rgba(15,23,42,0.24)]",
      className
    )}
  >
    <CardHeader
      className={cn("border-b border-slate-100 px-5 py-5 sm:px-6", headerClassName)}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-xl font-semibold tracking-tight text-slate-950">
            {title}
          </CardTitle>
          {description ? (
            <CardDescription className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              {description}
            </CardDescription>
          ) : null}
        </div>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </CardHeader>

    <CardContent className={cn("p-5 sm:p-6", contentClassName)}>
      {children}
    </CardContent>
  </Card>
);

export default SettingsPanel;
