"use client";
import type { AppDef } from "./apps";
import type { HealthResult } from "../hooks/use-health";
import { BoltIcon, DatabaseIcon, ChevronRightIcon, LockIcon, ActivityIcon } from "./icons";
import { StatusBadge, fmtCount, pingColor } from "./status-primitives";

interface Props {
  app: AppDef;
  result?: HealthResult;
  onOpen: (id: AppDef["id"]) => void;
  lastAccessedAt?: string | null;
}

export function ModuleCard({ app, result, onOpen, lastAccessedAt }: Props) {
  const state: "up" | "down" | "warn" | "probing" =
    !result ? "probing" :
    !result.reachable ? "down" :
    "up";

  const tone = app.tone;
  const disabled = state === "down";

  return (
    <button
      onClick={() => onOpen(app.id)}
      disabled={disabled}
      className={`group relative text-left rounded-2xl bg-white dark:bg-slate-800/80 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm card-hover focus-ring overflow-hidden ${
        disabled ? "opacity-60 cursor-not-allowed" : ""
      }`}
      aria-label={`Open ${app.name}`}
    >
      {/* accent stripe */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone.gradient}`} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${tone.gradient} text-white shadow-md`}>
            <app.icon className="h-5 w-5" />
          </div>
          <StatusBadge state={state} />
        </div>

        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{app.name}</h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{app.desc}</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat
            icon={<BoltIcon className="h-3 w-3" />}
            label="Ping"
            value={result ? `${result.pingMs}ms` : "—"}
            valueClass={result ? pingColor(result.pingMs) : "text-slate-400"}
          />
          <Stat
            icon={<DatabaseIcon className="h-3 w-3" />}
            label="Rows"
            value={result?.recordCount !== null && result?.recordCount !== undefined ? fmtCount(result.recordCount) : "—"}
          />
          <Stat
            icon={<ActivityIcon className="h-3 w-3" />}
            label="Last"
            value={lastAccessedAt ? relTime(lastAccessedAt) : "never"}
          />
        </div>

        <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[60%]">
            {app.url.replace("https://", "")}
          </span>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${tone.text} opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition`}>
            {disabled ? (
              <>
                <LockIcon className="h-3.5 w-3.5" /> Locked
              </>
            ) : (
              <>
                Open <ChevronRightIcon className="h-3.5 w-3.5" />
              </>
            )}
          </span>
        </div>
      </div>
    </button>
  );
}

function Stat({ icon, label, value, valueClass = "" }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col">
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {icon}
        {label}
      </span>
      <span className={`mt-0.5 text-sm font-semibold tabular-nums ${valueClass || "text-slate-700 dark:text-slate-200"}`}>{value}</span>
    </div>
  );
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "baru saja";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}