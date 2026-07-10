"use client";
import { useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";

type AppId = "finance" | "hr" | "hermez" | "hr-v1";

interface AppDef {
  id: AppId;
  name: string;
  desc: string;
  url: string;
  accent: string;       // bg color (Tailwind class)
  accentText: string;   // text color
  icon: ReactNode;
}

const FinanceIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h12M19 17l2-2-2-2" />
  </svg>
);
const HrIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM3 21a9 9 0 0 1 18 0" />
  </svg>
);
const HermezIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />
  </svg>
);
const SheetsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h9a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H9M9 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3M9 3v18M12 8h6M12 12h6M12 16h4" />
  </svg>
);

const APPS: AppDef[] = [
  { id: "finance", name: "Finance", desc: "POS, expenses, petty cash, payroll", url: "https://ykp-erp-finance-production.up.railway.app", accent: "bg-blue-600", accentText: "text-blue-600", icon: FinanceIcon },
  { id: "hr", name: "HR Production", desc: "Attendance, employees, rules, roster", url: "https://ykp-erp-hr-production.up.railway.app", accent: "bg-emerald-600", accentText: "text-emerald-600", icon: HrIcon },
  { id: "hermez", name: "Hermez AI", desc: "Briefs, alerts, config, run console", url: "https://ykp-erp-hermez-production.up.railway.app", accent: "bg-purple-600", accentText: "text-purple-600", icon: HermezIcon },
  { id: "hr-v1", name: "HR Pilot (Sheets)", desc: "Pilot attendance via Google Sheets", url: "https://ykp-hr-v1-standalone-production.up.railway.app", accent: "bg-orange-600", accentText: "text-orange-600", icon: SheetsIcon }
];

const HUB_SESSION_KEY = "ykp_hub_session";
const HUB_USER_KEY = "ykp_hub_user";

interface HubSession {
  username: string;
  role: string;
  ts: string;
}

interface HealthResult {
  id: string;
  name: string;
  url: string;
  pingMs: number;
  httpStatus: number | null;
  reachable: boolean;
  recordCount: number | null;
}
interface Health {
  overall: "ok" | "degraded" | "down";
  results: HealthResult[];
  ts: string;
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

function fmtCount(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("id-ID");
}

function StatusDot({ state }: { state: "up" | "down" | "warn" }) {
  const cls = state === "up" ? "bg-emerald-500" : state === "warn" ? "bg-amber-500" : "bg-rose-500";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} aria-hidden="true" />;
}

function ModuleStatus({ result }: { result?: HealthResult }) {
  if (!result) return <span className="text-xs text-slate-400">probing…</span>;
  if (!result.reachable) return <span className="inline-flex items-center gap-1.5 text-xs text-rose-700"><StatusDot state="down" /> DOWN</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
      <StatusDot state="up" /> UP · {result.pingMs}ms
      {result.recordCount !== null && <span className="text-slate-500">· {fmtCount(result.recordCount)} rows</span>}
    </span>
  );
}

export default function HubDashboard() {
  const [session, setSession] = useState<HubSession | null>(null);
  const [activeModule, setActiveModule] = useState<AppId | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [username, setUsername] = useState("owner");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Restore session
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(HUB_SESSION_KEY);
    if (!raw) return;
    try {
      const s = JSON.parse(raw) as HubSession;
      // Expire after 24h
      if (Date.now() - new Date(s.ts).getTime() < 24 * 3600 * 1000) {
        setSession(s);
      } else {
        localStorage.removeItem(HUB_SESSION_KEY);
      }
    } catch {
      localStorage.removeItem(HUB_SESSION_KEY);
    }
  }, []);

  // Fetch health every 30s
  const refreshHealth = useCallback(async () => {
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setHealth(j.data);
      }
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    void refreshHealth();
    const t = setInterval(refreshHealth, 30_000);
    return () => clearInterval(t);
  }, [refreshHealth]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      // Real auth via ykp-hr-v1 (shared user store)
      const r = await fetch("https://ykp-hr-v1-standalone-production.up.railway.app/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.error?.message ?? `Login gagal (HTTP ${r.status})`);
      }
      const role = (j?.data?.role ?? "VIEWER").toString().toUpperCase();
      const s: HubSession = { username, role, ts: new Date().toISOString() };
      localStorage.setItem(HUB_SESSION_KEY, JSON.stringify(s));
      localStorage.setItem(HUB_USER_KEY, username);
      setSession(s);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Login gagal");
    } finally {
      setLoggingIn(false);
    }
  }

  function logout() {
    localStorage.removeItem(HUB_SESSION_KEY);
    localStorage.removeItem(HUB_USER_KEY);
    setSession(null);
    setActiveModule(null);
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4-9 4-9-4ZM3 12l9 4 9-4M3 17l9 4 9-4" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white">YKP ERP</h1>
            <p className="text-slate-400 mt-1 text-sm">Unified Dashboard · Pilot</p>
          </div>
          <form onSubmit={login} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Login</h2>
              <p className="text-xs text-slate-500 mt-1">
                Menggunakan akun yang sama dengan HR Pilot. Default owner / owner123 (ganti sebelum produksi).
              </p>
            </div>
            <label className="block text-sm">
              <span className="text-slate-700">Username</span>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Password</span>
              <input
                type="password"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {loginError && <div className="text-sm text-rose-600">{loginError}</div>}
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loggingIn ? "Memverifikasi…" : "Sign in"}
            </button>
            <p className="text-xs text-slate-400 text-center">
              Setelah login, cookie sesi dishare ke 4 apps via domain yang sama.
            </p>
          </form>
        </div>
      </div>
    );
  }

  if (activeModule) {
    const app = APPS.find((a) => a.id === activeModule);
    if (!app) return null;
    const result = health?.results.find((r) => r.id === app.id);
    return (
      <div className="h-screen flex flex-col bg-slate-100">
        <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setActiveModule(null)} className="shrink-0 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <span className="text-slate-300">|</span>
            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${app.accent} text-white`}>{app.icon}</span>
            <span className="font-semibold text-slate-800 truncate">{app.name}</span>
            <ModuleStatus result={result} />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <div className="font-medium text-slate-800">{session.username}</div>
              <div className="text-xs text-slate-500">{ROLE_LABELS[session.role] ?? session.role}</div>
            </div>
            <button onClick={logout} className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100">
              Logout
            </button>
          </div>
        </header>
        <iframe
          src={app.url}
          className="flex-1 w-full border-0"
          title={app.name}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    );
  }

  const overallLabel =
    health?.overall === "ok" ? { text: "All systems operational", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" } :
    health?.overall === "degraded" ? { text: "Partial degradation", tone: "bg-amber-50 text-amber-800 border-amber-200" } :
    health?.overall === "down" ? { text: "All systems down", tone: "bg-rose-50 text-rose-800 border-rose-200" } :
    { text: "Probing…", tone: "bg-slate-50 text-slate-600 border-slate-200" };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4-9 4-9-4ZM3 12l9 4 9-4M3 17l9 4 9-4" />
              </svg>
            </span>
            <div>
              <h1 className="text-lg font-bold text-slate-900">YKP ERP</h1>
              <p className="text-xs text-slate-500">Unified Dashboard · Pilot</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm hidden sm:block">
              <div className="font-medium text-slate-800">{session.username}</div>
              <div className="text-xs text-slate-500">{ROLE_LABELS[session.role] ?? session.role}</div>
            </div>
            <button onClick={logout} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">
        <div className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${overallLabel.tone}`}>
          <span className="inline-flex items-center gap-2">
            <StatusDot state={health?.overall === "ok" ? "up" : health?.overall === "degraded" ? "warn" : health?.overall === "down" ? "down" : "warn"} />
            {overallLabel.text}
            {health && (
              <span className="ml-auto text-xs font-normal text-slate-500 hidden sm:inline">
                Updated {new Date(health.ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {APPS.map((app) => {
            const result = health?.results.find((r) => r.id === app.id);
            return (
              <button
                key={app.id}
                onClick={() => setActiveModule(app.id)}
                disabled={result && !result.reachable}
                className={`group text-left rounded-2xl p-5 ${app.accent} text-white shadow-md hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
                    {app.icon}
                  </span>
                  <span className="text-xs uppercase tracking-wide opacity-80">
                    {result ? (result.reachable ? "online" : "offline") : "…"}
                  </span>
                </div>
                <div className="mt-4 text-lg font-bold">{app.name}</div>
                <div className="text-sm opacity-90 mt-0.5">{app.desc}</div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="opacity-80 inline-flex items-center gap-1.5">
                    <StatusDot state={result?.reachable ? "up" : result ? "down" : "warn"} />
                    {result?.reachable ? `${result.pingMs}ms` : result ? "unreachable" : "probing…"}
                  </span>
                  <span className="opacity-90 font-medium group-hover:underline">Open →</span>
                </div>
                {result?.recordCount !== null && result?.recordCount !== undefined && (
                  <div className="mt-1 text-xs opacity-75">{fmtCount(result.recordCount)} records</div>
                )}
              </button>
            );
          })}
        </div>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">System Status</h2>
            <button
              onClick={refreshHealth}
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              Refresh
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {APPS.map((app) => {
              const result = health?.results.find((r) => r.id === app.id);
              return (
                <div key={app.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${app.accent} text-white`}>
                      {app.icon}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-slate-800">{app.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{app.url.replace("https://", "")}</div>
                    </div>
                  </div>
                  <ModuleStatus result={result} />
                </div>
              );
            })}
          </div>
        </section>

        <footer className="text-center text-xs text-slate-400 pt-2 pb-4">
          YKP HERMEZ AI Command Center · Build {new Date().toISOString().slice(0, 10)}
        </footer>
      </main>
    </div>
  );
}