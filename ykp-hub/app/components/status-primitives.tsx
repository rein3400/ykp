"use client";
import type { HealthResult } from "../hooks/use-health";
import { CheckIcon, AlertTriangleIcon } from "./icons";

export function fmtCount(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("id-ID");
}

export function pingTone(ms: number): "fast" | "ok" | "slow" {
  if (ms < 100) return "fast";
  if (ms < 300) return "ok";
  return "slow";
}
export function pingColor(ms: number): string {
  const t = pingTone(ms);
  return t === "fast" ? "text-emerald-700 dark:text-emerald-400" : t === "ok" ? "text-amber-700 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
}
export function pingBg(ms: number): string {
  const t = pingTone(ms);
  return t === "fast" ? "bg-emerald-500" : t === "ok" ? "bg-amber-500" : "bg-rose-500";
}

interface StatusDotProps {
  state: "up" | "down" | "warn" | "probing";
  pulse?: boolean;
  size?: "sm" | "md";
}
export function StatusDot({ state, pulse = false, size = "md" }: StatusDotProps) {
  const sz = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  const cls =
    state === "up" ? "bg-emerald-500" :
    state === "warn" ? "bg-amber-500" :
    state === "probing" ? "bg-slate-400" :
    "bg-rose-500";
  return <span className={`inline-block rounded-full ${sz} ${cls} ${pulse && state === "probing" ? "animate-pulse-dot" : ""}`} aria-hidden="true" />;
}

interface StatusBadgeProps {
  state: "up" | "down" | "warn" | "probing";
  label?: string;
}
export function StatusBadge({ state, label }: StatusBadgeProps) {
  const map = {
    up: { text: label ?? "Online", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800" },
    down: { text: label ?? "Offline", cls: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800" },
    warn: { text: label ?? "Degraded", cls: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800" },
    probing: { text: label ?? "Probing", cls: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700" }
  } as const;
  const v = map[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${v.cls}`}>
      <StatusDot state={state} size="sm" pulse />
      {v.text}
    </span>
  );
}

interface SparklineProps {
  data: number[];
  className?: string;
  height?: number;
}
export function Sparkline({ data, className = "", height = 24 }: SparklineProps) {
  if (data.length === 0) return <span className="text-xs text-slate-500 dark:text-slate-400">—</span>;
  const max = Math.max(...data, 1);
  const w = 80;
  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = height - (v / max) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const lastTone = pingTone(data[data.length - 1]);
  const stroke = lastTone === "fast" ? "hsl(158 64% 40%)" : lastTone === "ok" ? "hsl(38 92% 50%)" : "hsl(0 84% 60%)";
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className={className} width={w} height={height} aria-hidden="true">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={height - (data[data.length - 1] / max) * height} r={1.6} fill={stroke} />
    </svg>
  );
}

export function ModuleStatusInline({ result }: { result?: HealthResult }) {
  if (!result) return <StatusBadge state="probing" />;
  if (!result.reachable) return <StatusBadge state="down" />;
  return <StatusBadge state="up" label={`UP · ${result.pingMs}ms`} />;
}

export function OverallIcon({ overall }: { overall?: "ok" | "degraded" | "down" | "probing" }) {
  if (overall === "down") return <AlertTriangleIcon className="h-5 w-5" />;
  return <CheckIcon className="h-5 w-5" />;
}