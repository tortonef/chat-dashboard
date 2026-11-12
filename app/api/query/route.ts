import { runQuery } from "@/lib/db";

// Re-runs a saved widget's SQL. The SQL comes from the browser, so it goes
// through the same read-only, SELECT-only, row-capped path as LLM output.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (typeof body?.sql !== "string") return Response.json({ error: "Expected { sql }" }, { status: 400 });
  try {
    return Response.json({ rows: runQuery(body.sql) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
