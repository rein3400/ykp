"use client";
import { useEffect, useRef, useState } from "react";
import type { AppDef } from "./apps";
import type { HealthResult } from "../hooks/use-health";
import { ArrowLeftIcon, ExternalLinkIcon, ReloadIcon, AlertTriangleIcon, HubLogo, ChevronRightIcon, LogOutIcon } from "./icons";
import { Avatar } from "./avatar";
import { ThemeToggle } from "./theme-toggle";
import { ModuleStatusInline } from "./status-primitives";

interface Props {
  app: AppDef;
  session: { username: string; role: string };
  result?: HealthResult;
  onBack: () => void;
  onLogout: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner", SUPER_ADMIN: "Super Admin", HR_ADMIN: "HR Admin",
  FINANCE_ADMIN: "Finance Admin", BRAND_MANAGER: "Brand Manager",
  OUTLET_MANAGER: "Outlet Manager", SUPERVISOR: "Supervisor",
  EMPLOYEE: "Karyawan", VIEWER: "Viewer"
};

export function ModuleView({ app, session, result, onBack, onLogout }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoaded(false);
    setTimedOut(false);
    timerRef.current = setTimeout(() => {
      if (!loaded) setTimedOut(true);
    }, 12000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reloadKey, loaded]);

  return (
    <div className="h-screen flex flex-col bg-[hsl(var(--bg-sunken))] dark:bg-slate-950 animate-fade-in">
      <header className="glass border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-ring"
              aria-label="Back"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <span className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
            <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
              <HubLogo className="h-3.5 w-3.5 shrink-0" />
              <ChevronRightIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{app.name}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${app.tone.gradient} text-white shrink-0`}>
              <app.icon className="h-4 w-4" />
            </span>
            <div className="hidden md:block min-w-0">
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{app.name}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 -mt-0.5">{app.desc}</div>
            </div>
            <ModuleStatusInline result={result} />
            <a
              href={app.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus-ring"
              title="Open in new tab"
            >
              <ExternalLinkIcon className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">New tab</span>
            </a>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus-ring"
              title="Reload"
            >
              <ReloadIcon className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Reload</span>
            </button>
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
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus-ring"
              aria-label="Logout"
            >
              <LogOutIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <div className="relative flex-1 min-h-0">
        {/* Loading skeleton */}
        {!loaded && !timedOut && (
          <div className="absolute inset-0 z-10 bg-white dark:bg-slate-900 flex items-center justify-center animate-fade-in">
            <div className="text-center max-w-sm px-6">
              <div className={`mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${app.tone.gradient} text-white shadow-lg animate-pulse-dot`}>
                <app.icon className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">Memuat {app.name}…</p>
              <div className="mt-3 h-1.5 w-48 mx-auto rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                <div className="h-full w-1/3 bg-slate-400 dark:bg-slate-600 animate-shimmer rounded-full" />
              </div>
            </div>
          </div>
        )}
        {/* Timeout error */}
        {timedOut && (
          <div className="absolute inset-0 z-10 bg-white dark:bg-slate-900 flex items-center justify-center animate-fade-in">
            <div className="text-center max-w-sm px-6">
              <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                <AlertTriangleIcon className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">Gagal memuat {app.name}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Module tidak merespons dalam 12 detik. Coba lagi atau buka di tab baru.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 focus-ring"
                >
                  <ReloadIcon className="h-3.5 w-3.5" />
                  Coba lagi
                </button>
                <a
                  href={app.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus-ring"
                >
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                  Tab baru
                </a>
              </div>
            </div>
          </div>
        )}
        <iframe
          key={reloadKey}
          src={app.url}
          onLoad={() => setLoaded(true)}
          onError={() => setTimedOut(true)}
          className="absolute inset-0 w-full h-full border-0 bg-white"
          title={app.name}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
}