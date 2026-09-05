"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppDef } from "./apps";
import { SearchIcon, ChevronRightIcon, BoltIcon } from "./icons";
import { pingColor } from "./status-primitives";
import type { HealthResult } from "../hooks/use-health";

interface Props {
  open: boolean;
  onClose: () => void;
  apps: AppDef[];
  results: HealthResult[];
  onSelect: (id: AppDef["id"]) => void;
}

export function CommandPalette({ open, onClose, apps, results, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) => a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q));
  }, [apps, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        // Skip modules that report unreachable — activating them opens
        // nothing. Prefer the highlighted row, else the first reachable.
        const isUp = (a: AppDef) => {
          const r = results.find((x) => x.id === a.id);
          return !r || r.reachable;
        };
        const a =
          filtered.slice(cursor).find(isUp) ?? filtered.find(isUp);
        if (a) {
          onSelect(a.id);
          onClose();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, cursor, onSelect, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-800 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden animate-scale-in">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 px-4 py-3">
          <SearchIcon className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder="Cari module…"
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex rounded border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto scrollbar-thin p-2">
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Tidak ada hasil</li>
          )}
          {filtered.map((app, i) => {
            const r = results.find((x) => x.id === app.id);
            const active = i === cursor;
            return (
              <li key={app.id}>
                <button
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => {
                    onSelect(app.id);
                    onClose();
                  }}
                  disabled={r && !r.reachable}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition focus-ring ${
                    active ? "bg-blue-50 dark:bg-slate-700/60 ring-1 ring-blue-200 dark:ring-slate-600" : "ring-1 ring-transparent"
                  } disabled:opacity-50`}
                >
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${app.tone.gradient} text-white shrink-0`}>
                    <app.icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{app.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{app.desc}</div>
                  </div>
                  {r && (
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${pingColor(r.pingMs)}`}>
                      <BoltIcon className="h-3 w-3" />
                      {r.pingMs}ms
                    </span>
                  )}
                  <ChevronRightIcon className="h-4 w-4 text-slate-400" />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1"><kbd className="rounded border border-slate-200 dark:border-slate-700 px-1 py-0.5 font-mono">↑↓</kbd> Navigate</span>
            <span className="inline-flex items-center gap-1"><kbd className="rounded border border-slate-200 dark:border-slate-700 px-1 py-0.5 font-mono">↵</kbd> Open</span>
          </div>
          <span>{filtered.length} module</span>
        </div>
      </div>
    </div>
  );
}