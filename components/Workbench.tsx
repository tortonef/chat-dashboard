"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import type { Table } from "@/lib/db";
import type { Row } from "@/lib/widgets";

type Outcome = { rows: Row[]; ms: number } | { error: string };

const MAX_ROWS = 1000; // server-side cap in lib/db.ts

export default function Workbench({ tables, initial }: { tables: Table[]; initial?: string }) {
  const [sql, setSql] = useState(initial ?? `SELECT * FROM ${tables[0]?.name ?? "sqlite_master"} LIMIT 100`);
  const [outcome, setOutcome] = useState<Outcome>();
  const [busy, setBusy] = useState(false);

  const run = async (query: string) => {
    setBusy(true);
    const start = performance.now();
    try {
      const res = await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: query }) });
      const body = await res.json();
      setOutcome(body.rows ? { rows: body.rows, ms: Math.round(performance.now() - start) } : { error: body.error ?? "Unknown error" });
    } catch (e) {
      setOutcome({ error: String(e) });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    run(sql);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run the starting query once

  const preview = (table: string) => {
    const query = `SELECT * FROM ${table} LIMIT 100`;
    setSql(query);
    run(query);
  };

  return (
    <div className="flex flex-col md:h-[calc(100vh-3.5rem)] md:flex-row">
      <aside aria-label="Schema" className="shrink-0 overflow-y-auto border-line p-3 max-md:border-b md:w-64 md:border-r">
        <h2 className="px-1 pb-2 text-xs font-medium tracking-wide text-muted uppercase">Tables</h2>
        {tables.map((t) => (
          <details key={t.name} className="group" open={tables.length <= 6}>
            <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-grid">
              <span className="font-mono">{t.name}</span>
              <span className="ml-auto text-xs text-muted tabular-nums">{t.rows.toLocaleString("en-US")}</span>
              <button onClick={(e) => { e.preventDefault(); preview(t.name); }} className="rounded px-1.5 text-xs text-accent hover:underline" aria-label={`Preview rows of ${t.name}`}>
                view
              </button>
            </summary>
            <ul className="mb-2 ml-3 border-l border-line pl-3 font-mono text-xs text-ink-2">
              {t.columns.map((c) => (
                <li key={c.name} className="flex justify-between gap-2 py-0.5">
                  <span>
                    {c.name}
                    {c.pk && <span className="text-muted"> PK</span>}
                    {c.ref && <span className="text-muted"> → {c.ref}</span>}
                  </span>
                  <span className="text-muted">{c.type}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4">
        <form onSubmit={(e) => { e.preventDefault(); run(sql); }} className="space-y-2">
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(sql); } }}
            aria-label="SQL query"
            spellCheck={false}
            rows={7}
            className="block w-full resize-y rounded-xl border border-line bg-surface p-3 font-mono text-[13px] outline-none focus:border-accent"
          />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy || !sql.trim()} className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40">
              Run
            </button>
            <span className="text-xs text-muted max-sm:hidden">Ctrl + Enter · read-only, one SELECT at a time</span>
            <span className="ml-auto text-sm text-ink-2" role="status">
              {busy
                ? "Running…"
                : outcome && "rows" in outcome && `${outcome.rows.length.toLocaleString("en-US")} row${outcome.rows.length === 1 ? "" : "s"}${outcome.rows.length === MAX_ROWS ? " (capped)" : ""} · ${outcome.ms} ms`}
            </span>
          </div>
        </form>

        <div className="min-h-48 flex-1 overflow-auto rounded-xl border border-line bg-surface">
          {outcome && "error" in outcome ? (
            <p className="p-4 font-mono text-sm text-ink" role="alert">Error: {outcome.error}</p>
          ) : outcome?.rows.length ? (
            <DataTable rows={outcome.rows} raw />
          ) : (
            outcome && <p className="p-4 text-sm text-muted">The query returned no rows.</p>
          )}
        </div>
      </main>
    </div>
  );
}
