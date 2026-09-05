"use client";
import type { AppDef } from "./apps";
import { ssoUrl } from "./apps";
import { openAppUrl } from "./open-app";
import type { HealthResult } from "../hooks/use-health";
import { BoltIcon, DatabaseIcon, ChevronRightIcon, LockIcon, ActivityIcon, ExternalLinkIcon, EyeIcon } from "./icons";
import { StatusBadge, fmtCount, pingColor } from "./status-primitives";

interface Props {
  app: AppDef;
  result?: HealthResult;
  /** Hub session role — passed to the ERP app so it grants the same access. */
  role?: string;
  onPreview: (id: AppDef["id"]) => void;
  /** Open the module (new tab, same-tab fallback). Defaults to onPreview. */
  onOpen?: (id: AppDef["id"]) => void;
  lastAccessedAt?: string | null;
}

export function ModuleCard({ app, result, role, onPreview, onOpen, lastAccessedAt }: Props) {
  const state: "up" | "down" | "warn" | "probing" =
    !result ? "probing" :
    !result.reachable ? "down" :
    "up";

  const tone = app.tone;
  const disabled = state === "down";
  const open = onOpen ?? onPreview;
  const url = ssoUrl(app, role ?? "OWNER");

  function handleCardClick(e: React.MouseEvent) {
    if (disabled) return;
    // Let the Buka anchor / Preview button handle their own clicks.
    if ((e.target as HTMLElement).closest("a,button")) return;
    open(app.id);
  }

  function handleCardKey(e: React.KeyboardEvent) {
    if (disabled) return;
    if ((e.target as HTMLElement).closest("a,button")) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(app.id);
    }
  }

  function handleBukaClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Left-click only: let middle-click/modifiers keep native tab behavior.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openAppUrl(url);
  }

  return (
    <div
      className={`group relative rounded-2xl bg-white dark:bg-slate-800/80 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm card-hover overflow-hidden ${
        disabled ? "opacity-60" : "cursor-pointer"
      }`}
      role={disabled ? undefined : "link"}
      aria-label={disabled ? undefined : `Buka ${app.name}`}
      tabIndex={disabled ? undefined : 0}
      onClick={handleCardClick}
      onKeyDown={handleCardKey}
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

        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
          <div className="font-mono text-[10px] text-slate-400 dark:text-slate-500 truncate">
            {app.url.replace("https://", "")}
          </div>
          <div className="flex items-center gap-2">
            {disabled ? (
              <div className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-500">
                <LockIcon className="h-3.5 w-3.5" /> Locked
              </div>
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                onClick={handleBukaClick}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r ${tone.gradient} px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition focus-ring`}
                aria-label={`Buka ${app.name} di tab baru`}
              >
                <ExternalLinkIcon className="h-3.5 w-3.5" />
                Buka
                <ChevronRightIcon className="h-3 w-3" />
              </a>
            )}
            <button
              type="button"
              onClick={() => onPreview(app.id)}
              disabled={disabled}
              className={`inline-flex items-center justify-center gap-1 rounded-lg border ${tone.ring} bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold ${tone.text} hover:bg-slate-50 dark:hover:bg-slate-700 focus-ring disabled:opacity-50 disabled:cursor-not-allowed transition`}
              aria-label={`Preview ${app.name} di hub`}
              title="Buka di tab baru (auto-login via SSO)"
            >
              <EyeIcon className="h-3.5 w-3.5" />
              Preview
            </button>
          </div>
        </div>
      </div>
    </div>
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