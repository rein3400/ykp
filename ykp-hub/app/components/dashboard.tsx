"use client";
import { useEffect, useMemo, useState } from "react";
import type { Health, HealthResult } from "../hooks/use-health";
import type { AppDef } from "./apps";
import { HubLogo, SearchIcon, LogOutIcon, ChevronRightIcon } from "./icons";
import { Avatar } from "./avatar";
import { ThemeToggle } from "./theme-toggle";
import { StatusBanner } from "./status-banner";
import { StatusList } from "./status-list";
import { ModuleCard } from "./module-card";

interface Props {
  apps: AppDef[];
  session: { username: string; role: string };
  health: Health | null;
  history: Record<string, number[]>;
  loading: boolean;
  onOpen: (id: AppDef["id"]) => void;
  onOpenPalette: () => void;
  onRefresh: () => void;
  onLogout: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
  FINANCE_ADMIN: "Finance Admin",
  BRAND_MANAGER: "Brand Manager",
  OUTLET_MANAGER: "Outlet Manager",
  SUPERVISOR: "Supervisor",
  EMPLOYEE: "Karyawan",
  VIEWER: "Viewer"
};

export function Dashboard(props: Props) {
  const { session, health, history, loading, onOpen, onOpenPalette, onRefresh, onLogout } = props;

  // greeting
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 18) return "Selamat sore";
    return "Selamat malam";
  }, []);

  // last-accessed (per app) from localStorage
  const [lastAccess, setLastAccess] = useState<Record<string, string>>({});
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("ykp_hub_last_access");
      if (raw) setLastAccess(JSON.parse(raw));
    } catch {}
  }, []);

  return (
    <div className="min-h-screen gradient-mesh">
      <header className="sticky top-0 z-30 glass border-b border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shrink-0">
              <HubLogo className="h-5 w-5" />
            </span>
            <div className="min-w-0 hidden sm:block">
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">YKP ERP</h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-0.5">Unified Dashboard</p>
            </div>
          </div>

          <button
            onClick={onOpenPalette}
            className="hidden md:inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 focus-ring transition"
            aria-label="Open command palette"
          >
            <SearchIcon className="h-3.5 w-3.5" />
            Cari module…
            <kbd className="ml-2 rounded border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </button>

          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-slate-200 dark:border-slate-700">
              <Avatar name={session.username} size="sm" />
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{session.username}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5">{ROLE_LABELS[session.role] ?? session.role}</div>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus-ring transition"
              aria-label="Logout"
            >
              <LogOutIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">
        {/* Welcome */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
              {greeting}, {session.username} 👋
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Pilih module di bawah atau tekan <kbd className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd> untuk cari.
            </p>
          </div>
        </div>

        <StatusBanner health={health} loading={loading} />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {props.apps.map((app) => {
            const r = health?.results.find((x: HealthResult) => x.id === app.id);
            return (
              <ModuleCard
                key={app.id}
                app={app}
                result={r}
                onOpen={onOpen}
                lastAccessedAt={lastAccess[app.id] ?? null}
              />
            );
          })}
        </div>

        <StatusList
          apps={props.apps}
          results={health?.results ?? []}
          history={history}
          onOpen={onOpen}
          onRefresh={onRefresh}
          loading={loading}
        />

        <Footer />
      </main>
    </div>
  );
}

function Footer() {
  const buildDate = new Date().toISOString().slice(0, 10);
  return (
    <footer className="mt-4 pt-6 border-t border-slate-200/60 dark:border-slate-800/60">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <div className="font-semibold text-slate-700 dark:text-slate-200">YKP ERP</div>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Unified dashboard for HR, Finance, Hermez, dan HR Pilot.</p>
        </div>
        <div>
          <div className="font-semibold text-slate-700 dark:text-slate-200">Modules</div>
          <ul className="mt-1 space-y-0.5 text-slate-500 dark:text-slate-400">
            <li><a className="hover:text-blue-600 dark:hover:text-blue-400" href="https://ykp-erp-finance-production.up.railway.app" target="_blank" rel="noreferrer">Finance</a></li>
            <li><a className="hover:text-emerald-600 dark:hover:text-emerald-400" href="https://ykp-erp-hr-production.up.railway.app" target="_blank" rel="noreferrer">HR Production</a></li>
            <li><a className="hover:text-purple-600 dark:hover:text-purple-400" href="https://ykp-erp-hermez-production.up.railway.app" target="_blank" rel="noreferrer">Hermez AI</a></li>
            <li><a className="hover:text-orange-600 dark:hover:text-orange-400" href="https://ykp-hr-v1-standalone-production.up.railway.app" target="_blank" rel="noreferrer">HR Pilot</a></li>
          </ul>
        </div>
        <div className="text-right">
          <div className="font-semibold text-slate-700 dark:text-slate-200">Build</div>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            v0.1.0 · {buildDate}
            <br />
            <a className="hover:text-blue-600 dark:hover:text-blue-400" href="https://github.com/rein3400/ykp" target="_blank" rel="noreferrer">Repository ↗</a>
          </p>
        </div>
      </div>
      <div className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
        © YKP Developer · Made with care for the pilot launch.
      </div>
    </footer>
  );
}