"use client";

import { label } from "@/components/DataTable";
import type { Table } from "@/lib/db";
import type { Filter } from "@/lib/filters";

const key = (f: { table: string; column: string }) => `${f.table}.${f.column}`;
const dateInput = "rounded-lg border border-line bg-page px-2 py-1 text-sm text-ink outline-none focus:border-accent";

/** Global filters: pick a column, then toggle values or set a date range. Every widget is re-queried through them. */
export default function FilterBar({ tables, filters, onChange }: { tables: Table[]; filters: Filter[]; onChange: (next: Filter[]) => void }) {
  // Only columns the server can filter on: a short list of known values, or a date range.
  const columns = tables.flatMap((t) => t.columns.filter((c) => c.values || c.range).map((c) => ({ ...c, table: t.name, column: c.name })));
  const update = (i: number, change: Partial<Filter>) => onChange(filters.map((f, j) => (j === i ? { ...f, ...change } : f)));

  return (
    <div role="group" aria-label="Filters" className="flex flex-wrap items-center gap-2 pb-3">
      {filters.map((f, i) => {
        const col = columns.find((c) => key(c) === key(f));
        if (!col) return null; // column no longer exists in this database
        const name = label(f.column);
        return (
          <div key={key(f)} role="group" aria-label={`${name} filter`} title={key(f)} className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface py-1.5 pr-1 pl-3">
            <span className="text-xs font-medium tracking-wide text-muted uppercase">{name}</span>
            {col.values ? (
              col.values.map((v) => {
                const on = f.values?.includes(v) ?? false;
                return (
                  <button
                    key={v}
                    aria-pressed={on}
                    onClick={() => update(i, { values: on ? f.values!.filter((x) => x !== v) : [...(f.values ?? []), v] })}
                    className="rounded-lg border border-line px-2 py-0.5 text-sm text-ink-2 transition hover:text-ink aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white"
                  >
                    {v}
                  </button>
                );
              })
            ) : (
              <>
                <input type="date" aria-label={`${name} from`} className={dateInput} min={col.range![0]} max={f.to || col.range![1]} value={f.from ?? ""} onChange={(e) => update(i, { from: e.target.value })} />
                <span className="text-muted">–</span>
                <input type="date" aria-label={`${name} to`} className={dateInput} min={f.from || col.range![0]} max={col.range![1]} value={f.to ?? ""} onChange={(e) => update(i, { to: e.target.value })} />
              </>
            )}
            <button onClick={() => onChange(filters.filter((_, j) => j !== i))} aria-label={`Remove ${name} filter`} className="rounded-md px-2 text-lg leading-none text-muted transition hover:bg-grid hover:text-ink">
              ×
            </button>
          </div>
        );
      })}
      <select
        aria-label="Add filter"
        value=""
        onChange={(e) => {
          const col = columns.find((c) => key(c) === e.target.value);
          if (col) onChange([...filters, { table: col.table, column: col.column }]);
        }}
        className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink-2 outline-none focus:border-accent"
      >
        <option value="">+ Add filter</option>
        {columns.filter((c) => !filters.some((f) => key(f) === key(c))).map((c) => (
          <option key={key(c)} value={key(c)}>
            {c.table} · {label(c.column)}
          </option>
        ))}
      </select>
    </div>
  );
}
