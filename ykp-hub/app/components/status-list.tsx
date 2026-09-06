"use client";
import type { AppDef } from "./apps";
import type { HealthResult } from "../hooks/use-health";
import { ReloadIcon } from "./icons";
import { pingColor, Sparkline, StatusBadge } from "./status-primitives";

interface Props {
  apps: AppDef[];
  results: HealthResult[];
  history: Record<string, number[]>;
  onOpen: (id: AppDef["id"]) => void;
  onRefresh: () => void;
  loading: boolean;
}

export function StatusList({ apps, results, history, onOpen, onRefresh, loading }: Props) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-800/60 ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">System Status</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Latency timeseries · 30s refresh</p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 focus-ring rounded-md px-2 py-1"
          aria-label="Refresh"
        >
          <ReloadIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {apps.map((app) => {
          const r = results.find((x) => x.id === app.id);
          const hist = history[app.id] ?? [];
          const state: "up" | "down" | "warn" | "probing" = !r ? "probing" : !r.reachable ? "down" : "up";
          return (
            <button
              key={app.id}
              onClick={() => onOpen(app.id)}
              disabled={state === "down"}
              className="w-full px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 focus-ring text-left disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${app.tone.gradient} text-white shrink-0`}>
                  <app.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{app.name}</div>
                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">{app.url.replace("https://", "")}</div>
                </div>
              </div>
              <div className="hidden sm:block">
                <Sparkline data={hist} className="text-slate-400" />
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {r && (
                  <span className={`text-xs font-semibold tabular-nums ${pingColor(r.pingMs)}`}>
                    {r.pingMs}ms
                  </span>
                )}
                <StatusBadge state={state} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}