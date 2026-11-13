import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { applyFilters } from "./filters.ts";

export type Row = Record<string, string | number | null>;

const MAX_ROWS = 1000;
let db: DatabaseSync | undefined;

// Read-only connection is the real guard against LLM- or client-supplied SQL.
const conn = () =>
  (db ??= new DatabaseSync(path.join(process.cwd(), "data", "demo.db"), { readOnly: true }));

/**
 * Runs a single SELECT and returns at most MAX_ROWS rows. Throws on anything else.
 * `filters` are the dashboard's global filters (untrusted, validated in applyFilters).
 */
export function runQuery(sql: string, filters?: unknown): Row[] {
  // Blocks ATTACH/PRAGMA, which a read-only connection would still allow.
  if (!/^\s*(select|with)\b/i.test(sql)) throw new Error("Only SELECT queries are allowed");
  if (filters) sql = applyFilters(sql, filters, getTables());
  // shortcut: no query timeout, a pathological cross join can block the server; move to a worker with a deadline before hosting publicly
  const rows: Row[] = [];
  for (const row of conn().prepare(sql).iterate()) {
    rows.push(row as Row);
    if (rows.length >= MAX_ROWS) break;
  }
  return rows;
}

export type Column = {
  name: string;
  type: string;
  pk: boolean;
  ref?: string; // "table.column" for foreign keys
  values?: string[]; // all distinct values, for text columns with at most MAX_VALUES of them
  range?: [string, string]; // min and max, for date columns
};
export type Table = { name: string; rows: number; columns: Column[] };

const MAX_VALUES = 12;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
let tables: Table[] | undefined;

/** Tables with columns, keys, row counts and filterable values. Cached: the database is read-only. */
export function getTables(): Table[] {
  return (tables ??= runQuery("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").map(({ name }) => {
    const refs = new Map(
      runQuery(`SELECT "from" AS col, "table" || '.' || "to" AS ref FROM pragma_foreign_key_list('${name}')`).map((r) => [r.col, String(r.ref)]),
    );
    return {
      name: String(name),
      rows: Number(runQuery(`SELECT COUNT(*) AS n FROM "${name}"`)[0].n),
      columns: runQuery(`SELECT name, type, pk FROM pragma_table_info('${name}')`).map((c) => {
        const column: Column = { name: String(c.name), type: String(c.type), pk: !!c.pk, ref: refs.get(c.name) };
        if (column.type !== "TEXT") return column;
        const values = runQuery(`SELECT DISTINCT "${c.name}" AS v FROM "${name}" WHERE "${c.name}" IS NOT NULL ORDER BY 1 LIMIT ${MAX_VALUES + 1}`).map((r) => String(r.v));
        if (values.length <= MAX_VALUES) return { ...column, values };
        const [{ min, max }] = runQuery(`SELECT MIN("${c.name}") AS min, MAX("${c.name}") AS max FROM "${name}"`);
        return DATE.test(String(min)) && DATE.test(String(max)) ? { ...column, range: [String(min), String(max)] } : column;
      }),
    };
  }));
}

let schema: string | undefined;

/**
 * Schema description for the LLM prompt: CREATE TABLE statements plus the
 * distinct values of low-cardinality text columns, so the model filters on
 * values that exist ('Enterprise') instead of guessing ('corporate').
 */
export function getSchema(): string {
  if (schema) return schema;
  const create = new Map(runQuery("SELECT name, sql FROM sqlite_master WHERE type = 'table'").map((r) => [r.name, r.sql]));
  return (schema = getTables()
    .flatMap((t) => [String(create.get(t.name)), ...t.columns.filter((c) => c.values).map((c) => `-- ${t.name}.${c.name} values: ${c.values!.join(", ")}`)])
    .join("\n"));
}
