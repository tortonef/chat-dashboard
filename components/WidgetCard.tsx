"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useRef, useState } from "react";
import DataTable, { fmt, label } from "@/components/DataTable";
import { clamp, DEFAULT_H, type Row, type Widget } from "@/lib/widgets";

export type WidgetData = Row[] | { error: string } | undefined; // undefined = loading

const MAX_SERIES = 8; // the palette has 8 validated slots; never cycle colors
const color = (i: number) => `var(--s${i + 1})`;
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

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
  const h = widget.h ?? DEFAULT_H;

  if (chart === "kpi") return <p className="py-4 text-4xl font-semibold tracking-tight">{fmt(rows[0][y[0]])}</p>;

  if (chart === "table")
    return (
      <div className="overflow-auto" style={{ maxHeight: h }}>
        <DataTable rows={rows} />
      </div>
    );

  if (chart === "pie") {
    const slices = rows.slice(0, MAX_SERIES).map((r, i) => ({ ...r, fill: color(i) }));
    return (
      <ResponsiveContainer width="100%" height={h}>
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
    <ResponsiveContainer width="100%" height={h}>
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

type Props = {
  widget: Widget;
  data: WidgetData;
  onRemove: () => void;
  onChange: (patch: Partial<Widget>) => void; // resize
  onMove: (delta: number) => void; // keyboard reorder
  onDragStart: () => void;
  onDrop: () => void; // another widget was dropped on this one
};

export default function WidgetCard({ widget, data, onRemove, onChange, onMove, onDragStart, onDrop }: Props) {
  const card = useRef<HTMLElement>(null);
  const grip = useRef<HTMLButtonElement>(null);
  const resizing = useRef<{ x: number; y: number; span: number; h: number; col: number } | null>(null);
  const [over, setOver] = useState(false);
  const h = widget.h ?? DEFAULT_H;

  const resize = (span: number, height: number) => {
    const next = { span: clamp(span, 1, 3) as Widget["span"], h: clamp(height, 160, 640) };
    if (next.span !== widget.span || next.h !== h) onChange(next);
  };
  const arrows = (e: React.KeyboardEvent, horizontal: (d: number) => void, vertical: (d: number) => void) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (!d) return;
    e.preventDefault();
    (e.key === "ArrowLeft" || e.key === "ArrowRight" ? horizontal : vertical)(d);
  };
  const move = (d: number) => {
    onMove(d);
    requestAnimationFrame(() => grip.current?.focus()); // reordering the DOM drops focus
  };

  return (
    <section
      ref={card}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(); }}
      className={`group relative rounded-2xl border bg-surface p-4 ${over ? "border-accent" : "border-line"} ${SPAN[widget.span]}`}
    >
      {/* shortcut: HTML5 drag and drop has no touch support, on phones reorder with the keyboard handle or the chat; switch to pointer events if touch dragging matters */}
      <header
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", widget.id); // Firefox needs data to start a drag
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setDragImage(card.current!, 24, 24);
          onDragStart();
        }}
        className="mb-2 flex cursor-grab items-start gap-2 active:cursor-grabbing"
      >
        <button
          ref={grip}
          onKeyDown={(e) => arrows(e, move, move)}
          aria-label={`Move ${widget.title}. Drag, or use the arrow keys.`}
          className="absolute top-4 left-0.5 cursor-grab rounded text-xs leading-5 text-muted opacity-0 transition hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
        >
          ⠿
        </button>
        <h2 className="flex-1 text-sm font-medium text-ink-2">{widget.title}</h2>
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
      <button
        aria-label={`Resize ${widget.title}. Drag, or use the arrow keys: left and right for width, up and down for height.`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          resizing.current = { x: e.clientX, y: e.clientY, span: widget.span, h, col: card.current!.offsetWidth / widget.span };
        }}
        onPointerMove={(e) => {
          const s = resizing.current;
          if (s) resize(Math.round(s.span + (e.clientX - s.x) / s.col), Math.round((s.h + e.clientY - s.y) / 20) * 20);
        }}
        onPointerUp={() => (resizing.current = null)}
        onPointerCancel={() => (resizing.current = null)}
        onKeyDown={(e) => arrows(e, (d) => resize(widget.span + d, h), (d) => resize(widget.span, h + d * 20))}
        className="absolute right-1 bottom-1 size-4 cursor-nwse-resize touch-none rounded-br-lg border-r-2 border-b-2 border-muted opacity-0 transition hover:border-ink focus-visible:opacity-100 group-hover:opacity-100"
      />
    </section>
  );
}
