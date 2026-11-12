"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Row, Widget } from "@/lib/widgets";

export type WidgetData = Row[] | { error: string } | undefined; // undefined = loading

const MAX_SERIES = 8; // the palette has 8 validated slots; never cycle colors
const color = (i: number) => `var(--s${i + 1})`;
const label = (col: string) => col.replace(/_/g, " ");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const fmt = (v: unknown) => (typeof v === "number" ? full.format(v) : String(v ?? ""));

const SPAN = { 1: "", 2: "@2xl:col-span-2", 3: "@2xl:col-span-2 @4xl:col-span-3" };
const tick = { fill: "var(--muted)", fontSize: 12 };
const tooltip = (
  <Tooltip
    formatter={(v, name) => [fmt(v), label(String(name))]}
    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
    labelStyle={{ color: "var(--ink-2)" }}
    itemStyle={{ color: "var(--ink)" }}
    cursor={{ fill: "var(--grid)", stroke: "var(--axis)" }}
  />
);
// Legend text stays in ink; the swatch carries the series color.
const legend = <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: "var(--ink-2)", fontSize: 12 }}>{label(String(v))}</span>} />;

function Chart({ widget, rows }: { widget: Widget; rows: Row[] }) {
  const { chart, x } = widget;
  const y = widget.y.slice(0, MAX_SERIES);

  if (chart === "kpi") return <p className="py-4 text-4xl font-semibold tracking-tight">{fmt(rows[0][y[0]])}</p>;

  if (chart === "table") {
    const cols = Object.keys(rows[0]);
    return (
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="sticky top-0 bg-surface text-ink-2">
            <tr>{cols.map((c) => <th key={c} scope="col" className="border-b border-line px-2 py-1.5 font-medium capitalize">{label(c)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                {cols.map((c) => <td key={c} className="px-2 py-1.5">{fmt(r[c])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (chart === "pie") {
    const slices = rows.slice(0, MAX_SERIES).map((r, i) => ({ ...r, fill: color(i) }));
    return (
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          {/* surface-colored stroke = the gap between slices */}
          <Pie data={slices} dataKey={y[0]} nameKey={x} innerRadius="55%" outerRadius="85%" stroke="var(--surface)" strokeWidth={2} />
          {tooltip}
          {legend}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const Root = { bar: BarChart, line: LineChart, area: AreaChart }[chart];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <Root data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey={x} tick={tick} stroke="var(--axis)" tickLine={false} minTickGap={24} />
        <YAxis tick={tick} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => compact.format(v)} />
        {tooltip}
        {y.length > 1 && legend}
        {y.map((col, i) =>
          chart === "bar" ? (
            <Bar key={col} dataKey={col} fill={color(i)} radius={[4, 4, 0, 0]} maxBarSize={32} />
          ) : chart === "line" ? (
            <Line key={col} dataKey={col} stroke={color(i)} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          ) : (
            <Area key={col} dataKey={col} stroke={color(i)} strokeWidth={2} fill={color(i)} fillOpacity={0.15} />
          ),
        )}
      </Root>
    </ResponsiveContainer>
  );
}

export default function WidgetCard({ widget, data, onRemove }: { widget: Widget; data: WidgetData; onRemove: () => void }) {
  return (
    <section className={`group rounded-2xl border border-line bg-surface p-4 ${SPAN[widget.span]}`}>
      <header className="mb-2 flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium text-ink-2">{widget.title}</h2>
        <button
          onClick={onRemove}
          aria-label={`Remove ${widget.title}`}
          className="-m-1 rounded-md px-2 text-lg leading-none text-muted opacity-0 transition hover:bg-grid hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
        >
          ×
        </button>
      </header>
      {data === undefined ? (
        <div className="h-16 animate-pulse rounded-lg bg-grid" role="status" aria-label="Loading" />
      ) : "error" in data ? (
        <p className="text-sm text-ink-2" role="alert">Query failed: {data.error}</p>
      ) : data.length === 0 ? (
        <p className="py-6 text-sm text-muted">No data for this query.</p>
      ) : (
        <Chart widget={widget} rows={data} />
      )}
    </section>
  );
}
