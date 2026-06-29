import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

const COLORS = ["#2563eb", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];
const tooltip = { borderRadius: 14, border: "1px solid rgba(148,163,184,.25)", boxShadow: "0 18px 50px rgba(15,23,42,.16)" };
const Frame = ({ children }) => <div className="h-[320px] min-w-0 w-full">{children}</div>;

const Axis = () => (
  <>
    <CartesianGrid stroke="rgba(148,163,184,.18)" strokeDasharray="4 4" />
    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
    <Tooltip contentStyle={tooltip} />
    <Legend />
  </>
);

const Timeline = ({ data, burnup = false }) => (
  <Frame>
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 16, right: 12, bottom: 8, left: -12 }}>
        <Axis />
        <Area dataKey={burnup ? "scope" : "ideal"} fill="#dbeafe" stroke="#93c5fd" name={burnup ? "Scope" : "Ideal"} />
        <Line dataKey={burnup ? "completed" : "remaining"} stroke="#2563eb" strokeWidth={3} dot={false} name={burnup ? "Completed" : "Remaining"} />
      </ComposedChart>
    </ResponsiveContainer>
  </Frame>
);

const Trend = ({ data }) => (
  <Frame><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 16, right: 12, left: -12 }}><Axis /><Bar dataKey="created" fill="#93c5fd" radius={[6, 6, 0, 0]} name="Created" /><Line dataKey="completed" stroke="#10b981" strokeWidth={3} dot={false} name="Completed" /></ComposedChart></ResponsiveContainer></Frame>
);
const Cfd = ({ data }) => (
  <Frame><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 16, right: 12, left: -12 }}><Axis /><Area stackId="flow" dataKey="todo" fill="#cbd5e1" stroke="#94a3b8" /><Area stackId="flow" dataKey="active" fill="#93c5fd" stroke="#3b82f6" /><Area stackId="flow" dataKey="done" fill="#6ee7b7" stroke="#10b981" /></AreaChart></ResponsiveContainer></Frame>
);
const Velocity = ({ data }) => (
  <Frame><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 16, right: 12, left: -12 }}><Axis /><Bar dataKey="committed" fill="#bfdbfe" radius={[6, 6, 0, 0]} /><Bar dataKey="delivered" fill="#2563eb" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></Frame>
);
const Donut = ({ data }) => (
  <Frame><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={68} outerRadius={108} paddingAngle={3}>{data.map((row, index) => <Cell key={row.name} fill={row.color || COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltip} /><Legend /></PieChart></ResponsiveContainer></Frame>
);
const Tree = ({ data }) => (
  <Frame><ResponsiveContainer width="100%" height="100%"><Treemap data={data} dataKey="value" nameKey="name" stroke="#fff" fill="#2563eb" aspectRatio={4 / 3}><Tooltip contentStyle={tooltip} /></Treemap></ResponsiveContainer></Frame>
);
const Bubble = ({ data }) => (
  <Frame><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 20, right: 20, bottom: 16, left: 0 }}><CartesianGrid stroke="rgba(148,163,184,.18)" /><XAxis type="number" dataKey="x" name="Delivered" /><YAxis type="number" dataKey="y" name="Quality" /><ZAxis type="number" dataKey="z" range={[90, 720]} name="Workload" /><Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={tooltip} /><Scatter data={data} fill="#2563eb" /></ScatterChart></ResponsiveContainer></Frame>
);
const Pipeline = ({ data }) => (
  <Frame><ResponsiveContainer width="100%" height="100%"><FunnelChart><Tooltip contentStyle={tooltip} /><Funnel dataKey="value" data={data} isAnimationActive><LabelList position="right" fill="#334155" stroke="none" dataKey="name" />{data.map((row, index) => <Cell key={row.name} fill={COLORS[index % COLORS.length]} />)}</Funnel></FunnelChart></ResponsiveContainer></Frame>
);

const Heatmap = ({ data }) => (
  <div className="grid grid-cols-7 gap-2 py-4">
    {data.map((row) => <div key={row.name} title={`${row.name}: ${row.value}`} className="group flex aspect-square items-center justify-center rounded-xl border border-white/50 text-xs font-bold text-slate-700 transition hover:-translate-y-0.5" style={{ backgroundColor: `rgba(244,63,94,${Math.max(.08, Math.min(.9, row.value / Math.max(...data.map((item) => item.value), 1)))})` }}>{row.value}</div>)}
  </div>
);
const Gantt = ({ data }) => (
  <div className="space-y-3 py-3">
    {data.slice(0, 10).map((row, index) => <div key={row.id || row.name} className="grid grid-cols-[minmax(110px,1fr)_2fr] items-center gap-3"><span className="truncate text-xs font-semibold text-slate-600">{row.name}</span><div className="h-7 rounded-lg bg-slate-100 p-1"><div className="h-full rounded-md bg-gradient-to-r from-blue-500 to-cyan-400" style={{ marginLeft: `${Math.min(row.offset || index * 3, 55)}%`, width: `${Math.max(8, Math.min(row.duration || 25, 70))}%` }} /></div></div>)}
  </div>
);

export default function EnterpriseChart({ data = [], kind }) {
  if (!data.length) return <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">No chart data in the current scope</div>;
  if (kind === "burndown") return <Timeline data={data} />;
  if (kind === "burnup") return <Timeline data={data} burnup />;
  if (kind === "cfd") return <Cfd data={data} />;
  if (kind === "velocity") return <Velocity data={data} />;
  if (kind === "pie") return <Donut data={data} />;
  if (kind === "treemap") return <Tree data={data} />;
  if (kind === "bubble" || kind === "scatter") return <Bubble data={data} />;
  if (kind === "funnel") return <Pipeline data={data} />;
  if (kind === "heatmap") return <Heatmap data={data} />;
  if (kind === "gantt") return <Gantt data={data} />;
  return <Trend data={data} />;
}
