const COLORS = ["#2563eb", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));
const maxOf = (rows, keys) =>
  Math.max(1, ...rows.flatMap((row) => keys.map((key) => Number(row[key]) || 0)));

const Empty = () => (
  <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
    No chart data in the current scope
  </div>
);

const Frame = ({ children }) => (
  <div className="h-[320px] min-w-0 overflow-hidden rounded-2xl border border-white/60 bg-white/45 p-3">
    {children}
  </div>
);

const Svg = ({ children }) => (
  <svg className="h-full w-full overflow-visible" role="img" viewBox="0 0 640 300">
    <line x1="42" x2="620" y1="260" y2="260" stroke="#cbd5e1" strokeDasharray="4 6" />
    <line x1="42" x2="42" y1="24" y2="260" stroke="#cbd5e1" strokeDasharray="4 6" />
    {children}
  </svg>
);

const pointsFor = (data, key) => {
  const max = maxOf(data, [key]);
  const step = data.length > 1 ? 560 / (data.length - 1) : 0;

  return data.map((row, index) => ({
    label: row.name || row.label || `P${index + 1}`,
    value: Number(row[key]) || 0,
    x: 52 + step * index,
    y: 252 - ((Number(row[key]) || 0) / max) * 218,
  }));
};

const LineChart = ({ data, keys = ["completed"], fills = COLORS }) => (
  <Frame>
    <Svg>
      {keys.map((key, keyIndex) => {
        const points = pointsFor(data, key);
        const path = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");

        return (
          <g key={key}>
            <path d={path} fill="none" stroke={fills[keyIndex % fills.length]} strokeLinecap="round" strokeWidth="4" />
            {points.map((point) => (
              <circle key={`${key}-${point.label}`} cx={point.x} cy={point.y} fill="#fff" r="4" stroke={fills[keyIndex % fills.length]} strokeWidth="3">
                <title>{`${point.label}: ${point.value}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </Svg>
  </Frame>
);

const AreaChartLite = ({ data, keys = ["todo", "active", "done"] }) => {
  const max = maxOf(data, keys);
  const step = data.length > 1 ? 560 / (data.length - 1) : 0;

  return (
    <Frame>
      <Svg>
        {keys.map((key, keyIndex) => {
          const points = data.map((row, index) => ({
            x: 52 + step * index,
            y: 252 - ((Number(row[key]) || 0) / max) * 218,
          }));
          const path = [
            `M ${points[0]?.x || 52} 260`,
            ...points.map((point) => `L ${point.x} ${point.y}`),
            `L ${points.at(-1)?.x || 52} 260 Z`,
          ].join(" ");

          return (
            <path
              d={path}
              fill={COLORS[keyIndex % COLORS.length]}
              fillOpacity={0.18 + keyIndex * 0.08}
              key={key}
              stroke={COLORS[keyIndex % COLORS.length]}
              strokeWidth="2"
            />
          );
        })}
      </Svg>
    </Frame>
  );
};

const Bars = ({ data, keys = ["created", "completed"] }) => {
  const max = maxOf(data, keys);
  const groupWidth = Math.max(18, 560 / Math.max(data.length, 1));
  const barWidth = Math.max(6, groupWidth / (keys.length + 2));

  return (
    <Frame>
      <Svg>
        {data.map((row, rowIndex) =>
          keys.map((key, keyIndex) => {
            const height = ((Number(row[key]) || 0) / max) * 218;
            const x = 52 + rowIndex * groupWidth + keyIndex * barWidth;
            const y = 260 - height;

            return (
              <rect fill={COLORS[keyIndex % COLORS.length]} height={height} key={`${row.name}-${key}`} rx="6" width={barWidth - 2} x={x} y={y}>
                <title>{`${row.name || row.label}: ${key} ${row[key] || 0}`}</title>
              </rect>
            );
          })
        )}
      </Svg>
    </Frame>
  );
};

const Donut = ({ data }) => {
  const total = data.reduce((sum, row) => sum + (Number(row.value) || 0), 0) || 1;
  let offset = 25;

  return (
    <Frame>
      <div className="grid h-full place-items-center gap-3 md:grid-cols-[180px_1fr]">
        <svg className="h-44 w-44 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" fill="none" r="42" stroke="#e2e8f0" strokeWidth="18" />
          {data.map((row, index) => {
            const dash = ((Number(row.value) || 0) / total) * 264;
            const current = offset;
            offset -= dash;
            return (
              <circle
                cx="60"
                cy="60"
                fill="none"
                key={row.name}
                r="42"
                stroke={row.color || COLORS[index % COLORS.length]}
                strokeDasharray={`${dash} 264`}
                strokeDashoffset={current}
                strokeLinecap="round"
                strokeWidth="18"
              />
            );
          })}
        </svg>
        <div className="w-full space-y-2">
          {data.map((row, index) => (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 text-sm" key={row.name}>
              <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color || COLORS[index % COLORS.length] }} />
                <span className="truncate">{row.name}</span>
              </span>
              <span className="font-bold text-slate-900">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
};

const TreemapLite = ({ data }) => {
  const total = data.reduce((sum, row) => sum + (Number(row.value) || 0), 0) || 1;

  return (
    <Frame>
      <div className="flex h-full gap-2">
        {data.map((row, index) => (
          <div
            className="flex min-w-[54px] items-end rounded-2xl p-3 text-xs font-bold text-white shadow-inner"
            key={row.name}
            style={{
              background: `linear-gradient(145deg, ${COLORS[index % COLORS.length]}, #0f172a)`,
              flexGrow: Math.max(0.08, (Number(row.value) || 0) / total),
            }}
            title={`${row.name}: ${row.value}`}
          >
            <span className="line-clamp-3">{row.name}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
};

const Bubble = ({ data }) => {
  const maxX = maxOf(data, ["x"]);
  const maxY = maxOf(data, ["y"]);
  const maxZ = maxOf(data, ["z"]);

  return (
    <Frame>
      <Svg>
        {data.map((row, index) => {
          const x = 58 + ((Number(row.x) || 0) / maxX) * 540;
          const y = 252 - ((Number(row.y) || 0) / maxY) * 218;
          const r = 8 + ((Number(row.z) || 0) / maxZ) * 24;

          return (
            <circle cx={x} cy={y} fill={COLORS[index % COLORS.length]} fillOpacity="0.72" key={row.name} r={r} stroke="#fff" strokeWidth="3">
              <title>{`${row.name}: delivered ${row.x}, score ${row.y}, workload ${row.z}`}</title>
            </circle>
          );
        })}
      </Svg>
    </Frame>
  );
};

const Funnel = ({ data }) => {
  const max = maxOf(data, ["value"]);

  return (
    <Frame>
      <div className="flex h-full flex-col justify-center gap-3">
        {data.map((row, index) => (
          <div className="mx-auto rounded-xl px-4 py-3 text-center text-sm font-bold text-white shadow-sm" key={row.name} style={{ width: `${clamp((Number(row.value) / max) * 92, 18, 92)}%`, backgroundColor: COLORS[index % COLORS.length] }}>
            {row.name} · {row.value}
          </div>
        ))}
      </div>
    </Frame>
  );
};

const Heatmap = ({ data }) => {
  const max = maxOf(data, ["value"]);

  return (
    <div className="grid grid-cols-7 gap-2 rounded-2xl border border-white/60 bg-white/45 p-4">
      {data.map((row) => (
        <div
          className="group flex aspect-square items-center justify-center rounded-xl border border-white/50 text-xs font-bold text-slate-700 transition hover:-translate-y-0.5"
          key={row.name}
          style={{ backgroundColor: `rgba(244,63,94,${Math.max(0.08, Math.min(0.9, (Number(row.value) || 0) / max))})` }}
          title={`${row.name}: ${row.value}`}
        >
          {row.value}
        </div>
      ))}
    </div>
  );
};

const Gantt = ({ data }) => (
  <div className="space-y-3 rounded-2xl border border-white/60 bg-white/45 p-4">
    {data.slice(0, 10).map((row, index) => (
      <div className="grid grid-cols-[minmax(110px,1fr)_2fr] items-center gap-3" key={row.id || row.name}>
        <span className="truncate text-xs font-semibold text-slate-600">{row.name}</span>
        <div className="h-7 rounded-lg bg-slate-100 p-1">
          <div
            className="h-full rounded-md bg-gradient-to-r from-blue-500 to-cyan-400"
            style={{
              marginLeft: `${Math.min(row.offset || index * 3, 55)}%`,
              width: `${Math.max(8, Math.min(row.duration || 25, 70))}%`,
            }}
          />
        </div>
      </div>
    ))}
  </div>
);

export default function EnterpriseChart({ data = [], kind }) {
  if (!Array.isArray(data) || !data.length) return <Empty />;
  if (kind === "burndown") return <LineChart data={data} keys={["ideal", "remaining"]} fills={["#93c5fd", "#2563eb"]} />;
  if (kind === "burnup") return <LineChart data={data} keys={["scope", "completed"]} fills={["#93c5fd", "#10b981"]} />;
  if (kind === "cfd") return <AreaChartLite data={data} />;
  if (kind === "velocity") return <Bars data={data} keys={["committed", "delivered"]} />;
  if (kind === "pie") return <Donut data={data} />;
  if (kind === "treemap") return <TreemapLite data={data} />;
  if (kind === "bubble" || kind === "scatter") return <Bubble data={data} />;
  if (kind === "funnel") return <Funnel data={data} />;
  if (kind === "heatmap") return <Heatmap data={data} />;
  if (kind === "gantt") return <Gantt data={data} />;
  return <Bars data={data} keys={["created", "completed"]} />;
}
