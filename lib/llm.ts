import type { Widget } from "./widgets.ts";

export type Msg = { role: "system" | "user" | "assistant"; content: string };

// Groq exposes an OpenAI-compatible API, so plain fetch is enough.
const URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

/** One JSON-mode completion; returns the raw JSON string. */
export async function complete(messages: Msg[]): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set. Copy .env.example to .env.local and add your key.");
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0, response_format: { type: "json_object" } }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Groq API error ${res.status}: ${body?.error?.message ?? "unknown"}`);
  return body.choices[0].message.content ?? "";
}

export function systemPrompt(schema: string, widgets: Widget[]): string {
  return `You are the assistant of a data dashboard. The user describes what they want to see; you change the dashboard by returning actions. Each widget is a chart fed by one SQL query.

DATABASE (SQLite):
${schema}
Dates are TEXT in 'YYYY-MM-DD' format. Revenue is SUM(quantity * unit_price) from order_items, counted for orders with status = 'completed' unless the user says otherwise.

CURRENT WIDGETS:
${JSON.stringify(widgets)}

Respond ONLY with a JSON object: {"reply": string, "actions": Action[]}
Action is one of:
- {"type": "add", "widget": {"title", "chart", "sql", "x", "y", "span"}}
- {"type": "update", "id": "<existing widget id>", "widget": {only the fields that change}}
- {"type": "remove", "id": "<existing widget id>"}

Widget fields:
- chart: "bar" (compare categories), "line" or "area" (trend over time), "pie" (share of a total, at most 8 slices), "kpi" (one headline number), "table" (raw rows).
- sql: exactly one read-only SQLite SELECT. Give every column a readable snake_case alias. ORDER BY time for trends; use ORDER BY + LIMIT for top-N.
- x: the result column for the category or time axis ("" for kpi and table).
- y: array of numeric result columns, one per series (kpi uses the first; [] for table). For several series, return one column per series (pivot with SUM(CASE WHEN ...)), at most 8.
- span: width in grid columns, 1 to 3. Use 1 for kpi and pie, 2 for trends unless asked otherwise.

Rules:
- For relative periods ("last 3 months") anchor on the latest date in the data, e.g. (SELECT MAX(order_date) FROM orders), not on date('now').
- You cannot see query results. To answer a question about the data, add a kpi or table widget that shows the answer.
- If the request cannot be served from this database, return "actions": [] and say why in "reply".
- "reply" is one or two short sentences in the user's language describing what you did.`;
}
