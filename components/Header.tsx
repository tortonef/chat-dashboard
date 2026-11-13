"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  ["/", "Dashboard"],
  ["/database", "Database"],
  ["/sql", "SQL"],
];

export default function Header() {
  const path = usePathname();
  const [light, setLight] = useState(false);

  useEffect(() => {
    try {
      setLight(localStorage.getItem("theme") === "light");
    } catch {} // storage blocked: stay dark
  }, []);

  useEffect(() => {
    if (light) document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("theme", light ? "light" : "dark");
    } catch {}
  }, [light]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-line bg-page px-4 sm:px-6">
      <span className="font-semibold tracking-tight max-sm:hidden">Chat Dashboard</span>
      <nav aria-label="Main" className="flex gap-1">
        {LINKS.map(([href, name]) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
            className="rounded-lg px-3 py-1.5 text-sm text-ink-2 transition hover:text-ink aria-[current]:bg-grid aria-[current]:text-ink"
          >
            {name}
          </Link>
        ))}
      </nav>
      <button onClick={() => setLight(!light)} aria-pressed={light} className="ml-auto rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 transition hover:text-ink">
        {light ? "Dark" : "Light"} theme
      </button>
    </header>
  );
}
