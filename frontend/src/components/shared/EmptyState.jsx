import { Card, CardContent } from "@/components/ui/card";

const EmptyState = ({ title, description, action, icon }) => (
  <Card className="border-dashed border-gray-300 bg-white/80">
    <CardContent className="flex min-h-[260px] flex-col items-center justify-center px-6 py-10 text-center">
      {icon ? (
        <div className="mb-4 rounded-full border border-blue-200 bg-blue-50 p-3 text-blue-600">
          {icon}
        </div>
      ) : null}
      <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
      <p className="mt-3 max-w-md text-sm leading-6 text-gray-600">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </CardContent>
  </Card>
);

export default EmptyState;
