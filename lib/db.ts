import { DatabaseSync } from "node:sqlite";
import path from "node:path";

export type Row = Record<string, string | number | null>;

const MAX_ROWS = 1000;
let db: DatabaseSync | undefined;

// Read-only connection is the real guard against LLM- or client-supplied SQL.
const conn = () =>
  (db ??= new DatabaseSync(path.join(process.cwd(), "data", "demo.db"), { readOnly: true }));

/** Runs a single SELECT and returns at most MAX_ROWS rows. Throws on anything else. */
export function runQuery(sql: string): Row[] {
  // Blocks ATTACH/PRAGMA, which a read-only connection would still allow.
  if (!/^\s*(select|with)\b/i.test(sql)) throw new Error("Only SELECT queries are allowed");
  // shortcut: no query timeout, a pathological cross join can block the server; move to a worker with a deadline before hosting publicly
  const rows: Row[] = [];
  for (const row of conn().prepare(sql).iterate()) {
    rows.push(row as Row);
    if (rows.length >= MAX_ROWS) break;
  }
  return rows;
}

export type Table = {
  name: string;
  rows: number;
  columns: { name: string; type: string; pk: boolean; ref?: string }[]; // ref = "table.column" for foreign keys
};

/** Tables with columns, keys and row counts, for the Database and SQL pages. */
export function getTables(): Table[] {
  return runQuery("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").map(({ name }) => {
    const refs = new Map(
      runQuery(`SELECT "from" AS col, "table" || '.' || "to" AS ref FROM pragma_foreign_key_list('${name}')`).map((r) => [r.col, String(r.ref)]),
    );
    return {
      name: String(name),
      rows: Number(runQuery(`SELECT COUNT(*) AS n FROM "${name}"`)[0].n),
      columns: runQuery(`SELECT name, type, pk FROM pragma_table_info('${name}')`).map((c) => ({
        name: String(c.name),
        type: String(c.type),
        pk: !!c.pk,
        ref: refs.get(c.name),
      })),
    };
  });
}

let schema: string | undefined;

/**
 * Schema description for the LLM prompt: CREATE TABLE statements plus the
 * distinct values of low-cardinality text columns, so the model filters on
 * values that exist ('Enterprise') instead of guessing ('corporate').
 */
export function getSchema(): string {
  if (schema) return schema;
  const lines: string[] = [];
  for (const t of runQuery("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")) {
    lines.push(String(t.sql));
    for (const c of runQuery(`SELECT name FROM pragma_table_info('${t.name}') WHERE type = 'TEXT'`)) {
      const values = runQuery(`SELECT DISTINCT "${c.name}" AS v FROM "${t.name}" LIMIT 13`).map((r) => r.v);
      if (values.length <= 12) lines.push(`-- ${t.name}.${c.name} values: ${values.join(", ")}`);
    }
  }
  return (schema = lines.join("\n"));
}
