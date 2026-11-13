"use client";

import { useEffect, useRef, useState } from "react";
import Chat, { type ChatMsg } from "@/components/Chat";
import WidgetCard, { type WidgetData } from "@/components/WidgetCard";
import { DEFAULT_WIDGETS, reorder, type Result, type Widget } from "@/lib/widgets";

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

export default function Page() {
  const [widgets, setWidgets] = useState<Widget[] | null>(null); // null until loaded from localStorage
  const [data, setData] = useState<Record<string, WidgetData>>({});
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false); // small screens only
  const dragId = useRef<string | null>(null);

  const load = (list: Widget[]) => {
    setWidgets(list);
    setData({});
    for (const w of list)
      post("/api/query", { sql: w.sql })
        .then((res) => setData((d) => ({ ...d, [w.id]: res.rows ?? { error: res.error ?? "Unknown error" } })))
        .catch((e) => setData((d) => ({ ...d, [w.id]: { error: String(e) } })));
  };

  useEffect(() => {
    let saved: Widget[] | null = null;
    try {
      saved = JSON.parse(localStorage.getItem("widgets") ?? "null");
    } catch {} // storage blocked or corrupt: fall back to defaults
    load(Array.isArray(saved) ? saved : DEFAULT_WIDGETS);
  }, []);

  useEffect(() => {
    if (!widgets) return;
    try {
      localStorage.setItem("widgets", JSON.stringify(widgets));
    } catch {}
  }, [widgets]);

  const remove = (id: string) => setWidgets((ws) => ws && ws.filter((w) => w.id !== id));
  const patch = (id: string, change: Partial<Widget>) => setWidgets((ws) => ws && ws.map((w) => (w.id === id ? { ...w, ...change } : w)));
  // `to` gets the current list so the target index is computed on fresh state
  const move = (id: string | null, to: (ws: Widget[]) => number) => setWidgets((ws) => ws && reorder(ws, id, to(ws)));

  const send = async (text: string) => {
    const history: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setBusy(true);
    try {
      const res = await post("/api/chat", { messages: history, widgets });
      if (res.error) throw new Error(res.error);
      for (const r of res.results as Result[]) {
        if (r.type === "remove") remove(r.id);
        else {
          setData((d) => ({ ...d, [r.widget.id]: r.rows }));
          setWidgets((ws) => (ws!.some((w) => w.id === r.widget.id) ? ws!.map((w) => (w.id === r.widget.id ? r.widget : w)) : [...ws!, r.widget]));
        }
      }
      setMessages([...history, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setMessages([...history, { role: "assistant", content: `Something went wrong: ${e instanceof Error ? e.message : e}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lg:pr-96">
      <main className="@container px-4 pt-4 pb-24 sm:px-6">
        <div className="flex items-center justify-between gap-3 pb-3">
          <p className="text-sm text-muted">Drag a title to reorder, drag a corner to resize, or just ask the assistant.</p>
          <button className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 transition hover:text-ink" onClick={() => load(DEFAULT_WIDGETS)}>Reset</button>
        </div>
        <div className="grid grid-cols-1 items-start gap-4 @2xl:grid-cols-2 @4xl:grid-cols-3">
          {widgets?.map((w) => (
            <WidgetCard
              key={w.id}
              widget={w}
              data={data[w.id]}
              onRemove={() => remove(w.id)}
              onChange={(change) => patch(w.id, change)}
              onMove={(delta) => move(w.id, (ws) => ws.findIndex((x) => x.id === w.id) + delta)}
              onDragStart={() => (dragId.current = w.id)}
              onDrop={() => move(dragId.current, (ws) => ws.findIndex((x) => x.id === w.id))}
            />
          ))}
        </div>
        {widgets?.length === 0 && <p className="py-24 text-center text-muted">The dashboard is empty. Ask the assistant for a chart.</p>}
      </main>

      <aside aria-label="Assistant" className={`fixed top-14 right-0 bottom-0 z-10 w-full border-l border-line bg-surface sm:w-96 ${chatOpen ? "" : "max-lg:hidden"}`}>
        <Chat messages={messages} busy={busy} onSend={send} />
      </aside>
      <button onClick={() => setChatOpen(!chatOpen)} aria-expanded={chatOpen} className="fixed right-4 bottom-20 z-20 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-lg lg:hidden">
        {chatOpen ? "Close" : "Chat"}
      </button>
    </div>
  );
}
