// Global dashboard filters. Pure and shared by client (types) and server (applyFilters).
import type { Table } from "./db.ts";

export type Filter = {
  table: string;
  column: string;
  values?: string[]; // keep rows whose column is one of these (columns with `values`)
  from?: string; // inclusive YYYY-MM-DD bounds (columns with `range`)
  to?: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const quote = (v: string) => `'${v.replace(/'/g, "''")}'`;

/**
 * Makes any query respect the filters without touching its text: each filtered
 * table is shadowed by a CTE of the same name holding only the matching rows.
 * Filters flow down foreign keys (filter customers -> their orders -> those
 * orders' items), so a widget is filtered even if it never joins the filtered
 * table. Parent tables are not narrowed by filters on their children.
 *
 * `filters` comes from the browser: tables and columns must exist in the
 * schema, values must be known values of the column, dates must be ISO dates.
 * Anything else is ignored, so nothing unvalidated reaches the SQL text.
 */
export function applyFilters(sql: string, filters: unknown, tables: Table[]): string {
  const direct = new Map<string, string[]>(); // table -> conditions
  for (const f of Array.isArray(filters) ? (filters as Partial<Filter>[]) : []) {
    const col = tables.find((t) => t.name === f?.table)?.columns.find((c) => c.name === f.column);
    if (!col) continue;
    const conds: string[] = [];
    const values = Array.isArray(f.values) ? f.values.filter((v) => col.values?.includes(v)) : [];
    if (values.length) conds.push(`"${col.name}" IN (${values.map(quote).join(", ")})`);
    if (col.range && typeof f.from === "string" && DATE.test(f.from)) conds.push(`"${col.name}" >= '${f.from}'`);
    if (col.range && typeof f.to === "string" && DATE.test(f.to)) conds.push(`"${col.name}" <= '${f.to}'`);
    if (conds.length) direct.set(f.table!, [...(direct.get(f.table!) ?? []), ...conds]);
  }
  if (!direct.size) return sql;

  // Depth-first so a parent's CTE is defined before the children that reference it.
  const ctes: string[] = [];
  const filtered = new Map<string, boolean>();
  const build = (t: Table): boolean => {
    if (filtered.has(t.name)) return filtered.get(t.name)!;
    filtered.set(t.name, false); // breaks reference cycles
    const conds = [...(direct.get(t.name) ?? [])];
    for (const c of t.columns) {
      const [refTable, refColumn] = c.ref?.split(".") ?? [];
      const parent = tables.find((p) => p.name === refTable);
      if (parent && parent !== t && build(parent)) conds.push(`"${c.name}" IN (SELECT "${refColumn}" FROM "${parent.name}")`);
    }
    if (conds.length) ctes.push(`"${t.name}" AS (SELECT * FROM main."${t.name}" WHERE ${conds.join(" AND ")})`);
    filtered.set(t.name, conds.length > 0);
    return conds.length > 0;
  };
  tables.forEach(build);

  const own = sql.match(/^\s*with\s+(recursive\s+)?/i); // the query has its own CTEs: join the lists
  return own ? `WITH ${own[1] ?? ""}${ctes.join(", ")}, ${sql.slice(own[0].length)}` : `WITH ${ctes.join(", ")} ${sql}`;
}
