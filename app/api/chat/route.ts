import { getSchema, runQuery } from "@/lib/db";
import { complete, systemPrompt, type Msg } from "@/lib/llm";
import { checkColumns, resolveActions, validateWidget, type Result, type Widget } from "@/lib/widgets";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.messages) || !Array.isArray(body?.widgets))
    return Response.json({ error: "Expected { messages, widgets }" }, { status: 400 });

  // Client input: keep only well-formed, bounded data.
  const history: Msg[] = body.messages
    .filter((m: Msg) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m: Msg) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  const widgets: Widget[] = [];
  for (const w of body.widgets.slice(0, 30)) {
    try {
      widgets.push(validateWidget(w));
    } catch {} // drop malformed widgets
  }

  const convo: Msg[] = [{ role: "system", content: systemPrompt(getSchema(), widgets) }, ...history];
  try {
    for (let attempt = 0; ; attempt++) {
      const raw = await complete(convo);
      try {
        const parsed = JSON.parse(raw);
        const results: Result[] = resolveActions(parsed.actions ?? [], widgets).map((a) => {
          if (a.type === "remove") return a;
          const rows = runQuery(a.widget.sql, body.filters);
          checkColumns(a.widget, rows);
          return { ...a, rows };
        });
        return Response.json({ reply: String(parsed.reply ?? "Done."), results });
      } catch (e) {
        // One retry: hand the SQL / validation error back to the model.
        if (attempt === 1) return Response.json({ reply: `Sorry, I couldn't build that (${message(e)}). Try rephrasing.`, results: [] });
        convo.push({ role: "assistant", content: raw }, { role: "user", content: `That failed: ${message(e)}. Reply again with the corrected JSON.` });
      }
    }
  } catch (e) {
    return Response.json({ error: message(e) }, { status: 502 });
  }
}
