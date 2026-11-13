// Shared by client and server: the widget spec and the validation of LLM output.

export const CHARTS = ["bar", "line", "area", "pie", "kpi", "table"] as const;

export type Row = Record<string, string | number | null>;

export type Widget = {
  id: string;
  title: string;
  chart: (typeof CHARTS)[number];
  sql: string; // SELECT producing the data
  x: string; // category / time column
  y: string[]; // value columns, one per series
  span: 1 | 2 | 3; // grid columns
  h?: number; // chart height in px (default DEFAULT_H)
};

export const DEFAULT_H = 260;
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export type Action = { type: "set"; widget: Widget } | { type: "remove"; id: string };
export type Result = { type: "set"; widget: Widget; rows: Row[] } | { type: "remove"; id: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Returns a clean Widget or throws a message the model can act on. */
export function validateWidget(w: unknown): Widget {
  if (!isObj(w)) throw new Error("widget must be an object");
  const y = typeof w.y === "string" ? [w.y] : (w.y ?? []);
  if (typeof w.id !== "string" || !w.id) throw new Error("widget.id must be a string");
  if (typeof w.title !== "string" || !w.title.trim()) throw new Error("widget.title must be a non-empty string");
  if (!CHARTS.includes(w.chart as Widget["chart"])) throw new Error(`widget.chart must be one of ${CHARTS.join(", ")}`);
  if (typeof w.sql !== "string" || !w.sql.trim()) throw new Error("widget.sql must be a non-empty string");
  if (typeof (w.x ?? "") !== "string") throw new Error("widget.x must be a string");
  if (!Array.isArray(y) || y.some((c) => typeof c !== "string")) throw new Error("widget.y must be an array of column names");
  const span = w.span ?? 1;
  if (span !== 1 && span !== 2 && span !== 3) throw new Error("widget.span must be 1, 2 or 3");
  const h = w.h == null ? undefined : clamp(Number(w.h) || DEFAULT_H, 160, 640);
  return { id: w.id, title: w.title, chart: w.chart as Widget["chart"], sql: w.sql, x: (w.x as string) ?? "", y, span, ...(h && { h }) };
}

/** Turns the model's raw actions into validated ones; "update" patches are merged onto the existing widget. */
export function resolveActions(raw: unknown, current: Widget[]): Action[] {
  if (!Array.isArray(raw)) throw new Error('"actions" must be an array');
  return raw.map((a) => {
    if (!isObj(a)) throw new Error("each action must be an object");
    const existing = current.find((w) => w.id === a.id);
    if (a.type === "add") return { type: "set", widget: validateWidget({ ...(a.widget as object), id: crypto.randomUUID().slice(0, 8) }) };
    if (a.type !== "update" && a.type !== "remove") throw new Error('action.type must be "add", "update" or "remove"');
    if (!existing) throw new Error(`no widget with id "${a.id}"`);
    if (a.type === "remove") return { type: "remove", id: existing.id };
    return { type: "set", widget: validateWidget({ ...existing, ...(a.widget as object), id: existing.id }) };
  });
}

/** Moves the widget `id` to index `to`; returns the same list if either is out of range. */
export function reorder(list: Widget[], id: string | null, to: number): Widget[] {
  const from = list.findIndex((w) => w.id === id);
  if (from < 0 || to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/** Throws if the columns the chart needs are missing from the query result. */
export function checkColumns(w: Widget, rows: Row[]): void {
  if (!rows.length || w.chart === "table") return;
  if (!w.y.length) throw new Error(`"${w.title}": y needs at least one column`);
  const needed = w.chart === "kpi" ? [w.y[0]] : [w.x, ...w.y];
  const missing = needed.filter((c) => !(c in rows[0]));
  if (missing.length)
    throw new Error(`"${w.title}": column(s) ${missing.join(", ")} not in the query result (${Object.keys(rows[0]).join(", ")})`);
}

const REVENUE = "ROUND(SUM(oi.quantity * oi.unit_price)) AS revenue FROM order_items oi JOIN orders o ON o.id = oi.order_id";

export const DEFAULT_WIDGETS: Widget[] = [
  { id: "revenue", title: "Total revenue", chart: "kpi", sql: `SELECT ${REVENUE} WHERE o.status = 'completed'`, x: "", y: ["revenue"], span: 1 },
  { id: "orders", title: "Completed orders", chart: "kpi", sql: "SELECT COUNT(*) AS orders FROM orders WHERE status = 'completed'", x: "", y: ["orders"], span: 1 },
  { id: "customers", title: "Customers", chart: "kpi", sql: "SELECT COUNT(*) AS customers FROM customers", x: "", y: ["customers"], span: 1 },
  {
    id: "monthly",
    title: "Monthly revenue",
    chart: "area",
    sql: `SELECT strftime('%Y-%m', o.order_date) AS month, ${REVENUE} WHERE o.status = 'completed' GROUP BY month ORDER BY month`,
    x: "month",
    y: ["revenue"],
    span: 2,
  },
  {
    id: "category",
    title: "Revenue by category",
    chart: "pie",
    sql: `SELECT p.category, ${REVENUE} JOIN products p ON p.id = oi.product_id WHERE o.status = 'completed' GROUP BY p.category ORDER BY revenue DESC`,
    x: "category",
    y: ["revenue"],
    span: 1,
  },
];
