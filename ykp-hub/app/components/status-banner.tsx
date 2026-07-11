"use client";
import type { Health } from "../hooks/use-health";
import { OverallIcon, StatusDot } from "./status-primitives";

interface Props {
  health: Health | null;
  loading: boolean;
}

export function StatusBanner({ health, loading }: Props) {
  const total = health?.results.length ?? 0;
  const up = health?.results.filter((r) => r.reachable).length ?? 0;
  const state = health?.overall ?? "probing";

  const label =
    state === "ok" ? "All systems operational" :
    state === "degraded" ? "Partial degradation" :
    state === "down" ? "All systems down" :
    "Probing…";

  const tone =
    state === "ok" ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800" :
    state === "degraded" ? "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800" :
    state === "down" ? "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:ring-rose-800" :
    "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:ring-slate-700";

  const dotState = state === "ok" ? "up" : state === "degraded" ? "warn" : state === "down" ? "down" : "probing";

  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ring-1 ${tone}`}>
      <StatusDot state={dotState} pulse={loading} />
      <div className="flex items-center gap-2 text-sm font-medium">
        <OverallIcon overall={state} />
        <span>{label}</span>
        {total > 0 && (
          <span className="opacity-75">· {up}/{total} online</span>
        )}
      </div>
      <span className="ml-auto text-xs opacity-70 tabular-nums">
        {health ? `Updated ${new Date(health.ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : loading ? "Loading…" : "—"}
      </span>
    </div>
  );
}