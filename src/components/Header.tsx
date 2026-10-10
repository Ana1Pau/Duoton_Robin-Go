"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Status = { db: "sqlserver" | "memory"; reap: "live" | "mock" };

export function Header() {
  const { t, lang, setLang } = useI18n();
  const path = usePathname();
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    fetch("/api/status", { cache: "no-store" }).then((r) => r.json()).then(setStatus).catch(() => setStatus(null));
  }, [path]);

  const nav = (href: string, label: string) => (
    <Link href={href} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${path === href ? "bg-kater-100 text-kater-700" : "text-slate-600 hover:bg-slate-100"}`}>
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-3 py-2 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-kater-600 text-lg text-white" aria-hidden>🧺</span>
          <span>
            <span className="block text-lg font-bold leading-tight">Katerbot</span>
            <span className="hidden text-xs text-slate-500 sm:block">{t("tagline")}</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          {nav("/", t("nav_pantry"))}
          {nav("/demo", t("nav_demo"))}
        </nav>
        <div className="flex items-center gap-1 rounded-lg border border-slate-300 p-0.5" role="group" aria-label="Language">
          {(["es", "en"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`rounded-md px-2 py-1 text-xs font-bold uppercase ${lang === l ? "bg-kater-600 text-white" : "text-slate-600"}`} aria-pressed={lang === l}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {status && (
        <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-3 pb-2 sm:px-6">
          <span className={`badge ${status.reap === "mock" ? "bg-amber-100 text-amber-800" : "bg-kater-100 text-kater-700"}`}>
            {status.reap === "mock" ? t("mock_badge") : t("live_badge")}
          </span>
          <span className="badge bg-slate-100 text-slate-700">{status.db === "memory" ? t("db_memory") : t("db_sql")}</span>
        </div>
      )}
    </header>
  );
}
