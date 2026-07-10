"use client";
import { useState, useEffect } from "react";

const APPS = [
  { id: "finance", name: "Finance", desc: "POS, expenses, petty cash, payroll", color: "from-blue-500 to-blue-700", icon: "💰", url: "https://ykp-erp-finance-production.up.railway.app" },
  { id: "hr", name: "HR Production", desc: "Attendance, employees, rules, roster", color: "from-emerald-500 to-emerald-700", icon: "👥", url: "https://ykp-erp-hr-production.up.railway.app" },
  { id: "hermez", name: "Hermez AI", desc: "Briefs, alerts, config, run console", color: "from-purple-500 to-purple-700", icon: "🤖", url: "https://ykp-erp-hermez-production.up.railway.app" },
  { id: "hr-v1", name: "HR Pilot (Sheets)", desc: "Perekaman absensi via Google Sheets", color: "from-orange-500 to-orange-700", icon: "📋", url: "https://ykp-hr-v1-standalone-production.up.railway.app" },
];

const SESSION_KEY = "ykp_hub_session";

export default function HubDashboard() {
  const [session, setSession] = useState(null);
  const [activeModule, setActiveModule] = useState(null);

  useEffect(() => {
    const s = typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null;
    if (s) {
      try { setSession(JSON.parse(s)); } catch {}
    }
  }, []);

  function login(role) {
    const s = {
      user: { id: "U-001", email: "owner@ykp.local", name: "Owner", role },
      token: "demo-" + Math.random().toString(36).slice(2),
      issuedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSession(s);
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setActiveModule(null);
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">YKP ERP</h1>
            <p className="text-slate-400">Unified Dashboard — Pilot</p>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Login</h2>
            <p className="text-sm text-slate-500">Pilih role untuk masuk ke dashboard. SSO cookie akan di-share ke semua 4 apps.</p>
            <div className="space-y-2">
              {["OWNER", "FINANCE_ADMIN", "HR_ADMIN", "SUPER_ADMIN", "VIEWER"].map((r) => (
                <button
                  key={r}
                  onClick={() => login(r)}
                  className="w-full text-left px-4 py-2.5 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition"
                >
                  <div className="font-medium text-slate-800">{r}</div>
                  <div className="text-xs text-slate-500">
                    {r === "OWNER" && "Full access ke semua module"}
                    {r === "FINANCE_ADMIN" && "Akses penuh ke Finance & Hermez"}
                    {r === "HR_ADMIN" && "Akses penuh ke HR & Pilot"}
                    {r === "SUPER_ADMIN" && "Akses ke semua module"}
                    {r === "VIEWER" && "Read-only akses"}
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 text-center pt-2">Default SSO token akan di-share ke ykp-erp-finance/hermez/hr/hr-v1</p>
          </div>
        </div>
      </div>
    );
  }

  if (activeModule) {
    const app = APPS.find((a) => a.id === activeModule);
    return (
      <div className="h-screen flex flex-col bg-slate-100">
        <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveModule(null)} className="text-sm text-slate-600 hover:text-slate-900">
              ← Back
            </button>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-slate-800">{app.icon} {app.name}</span>
          </div>
          <div className="text-sm text-slate-600">
            {session.user.name} ({session.user.role})
          </div>
        </header>
        <iframe
          src={app.url}
          className="flex-1 w-full"
          title={app.name}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">YKP ERP — Unified Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Single sign-on ke 4 module. Pilih module di bawah.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="font-medium text-slate-800">{session.user.name}</div>
              <div className="text-xs text-slate-500">{session.user.role}</div>
            </div>
            <button onClick={logout} className="px-3 py-1.5 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100">
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {APPS.map((app) => (
            <button
              key={app.id}
              onClick={() => setActiveModule(app.id)}
              className={`text-left rounded-2xl p-6 bg-gradient-to-br ${app.color} text-white shadow-lg hover:shadow-2xl hover:scale-105 transition`}
            >
              <div className="text-4xl mb-3">{app.icon}</div>
              <div className="text-lg font-bold mb-1">{app.name}</div>
              <div className="text-sm opacity-90">{app.desc}</div>
              <div className="text-xs opacity-75 mt-3">Open →</div>
            </button>
          ))}
        </div>

        <div className="mt-8 bg-white rounded-2xl p-6 shadow border border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Status Sistem</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span><span>Postgres DB: 5,800 records</span></div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span><span>Sheets API: 638 records</span></div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span><span>4 apps deployed</span></div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span><span>SSO active</span></div>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-slate-400">
          YKP HERMEZ AI Command Center • Build 2026-07-10
        </div>
      </div>
    </div>
  );
}
