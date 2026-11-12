"use client";

import { useEffect, useRef, useState } from "react";

export type ChatMsg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Show the top 5 products by revenue",
  "Compare monthly revenue by customer segment as lines",
  "Turn the monthly revenue chart into bars",
  "Add a table of the 10 most recent orders",
];

export default function Chat({ messages, busy, onSend }: { messages: ChatMsg[]; busy: boolean; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const submit = (value: string) => {
    if (!value.trim() || busy) return;
    onSend(value.trim());
    setText("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-ink-2">Describe what you want to see and I'll query the database and update the dashboard.</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => submit(s)} className="block w-full rounded-xl border border-line px-3 py-2 text-left text-sm text-ink-2 transition hover:border-accent hover:text-ink">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <p key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-accent text-white" : "bg-grid text-ink"}`}>
            {m.content}
          </p>
        ))}
        {busy && <p className="w-fit animate-pulse rounded-2xl bg-grid px-3 py-2 text-sm text-ink-2">Thinking…</p>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); submit(text); }} className="flex gap-2 border-t border-line p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Message"
          placeholder="Ask for a chart…"
          className="min-w-0 flex-1 rounded-xl border border-line bg-page px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
        <button type="submit" disabled={busy || !text.trim()} className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40">
          Send
        </button>
      </form>
    </div>
  );
}
