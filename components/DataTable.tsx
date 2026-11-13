import type { Row } from "@/lib/widgets";

const full = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
export const label = (col: string) => col.replace(/_/g, " ");
export const fmt = (v: unknown) => (typeof v === "number" ? full.format(v) : String(v ?? ""));

/** Result grid. `raw` shows column names and values exactly as SQLite returns them. The caller provides the scroll container. */
export default function DataTable({ rows, raw }: { rows: Row[]; raw?: boolean }) {
  const cols = Object.keys(rows[0]);
  return (
    <table className={`w-full text-left text-sm tabular-nums ${raw ? "font-mono text-[13px]" : ""}`}>
      <thead className="sticky top-0 bg-surface text-ink-2">
        <tr>
          {cols.map((c) => (
            <th key={c} scope="col" className={`border-b border-line px-2 py-1.5 font-medium whitespace-nowrap ${raw ? "" : "capitalize"}`}>
              {raw ? c : label(c)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line last:border-0">
            {cols.map((c) => (
              <td key={c} className="px-2 py-1.5 whitespace-nowrap">
                {!raw ? fmt(r[c]) : r[c] === null ? <span className="text-muted">NULL</span> : String(r[c])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
