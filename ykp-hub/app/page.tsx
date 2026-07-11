"use client";
import { useEffect, useState, useCallback } from "react";
import { APPS, type AppId } from "./components/apps";
import { LoginForm } from "./components/login-form";
import { Dashboard } from "./components/dashboard";
import { ModuleView } from "./components/module-view";
import { CommandPalette } from "./components/command-palette";
import { useHealth } from "./hooks/use-health";
import { useShortcuts } from "./hooks/use-shortcuts";

const HUB_SESSION_KEY = "ykp_hub_session";
const HUB_LAST_ACCESS_KEY = "ykp_hub_last_access";

interface HubSession {
  username: string;
  role: string;
  ts: string;
}

export default function HubDashboard() {
  const [session, setSession] = useState<HubSession | null>(null);
  const [activeModule, setActiveModule] = useState<AppId | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const { health, history, loading, refresh } = useHealth(30_000);

  // Restore session
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(HUB_SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as HubSession;
      if (Date.now() - new Date(s.ts).getTime() < 24 * 3600 * 1000) {
        setSession(s);
      } else {
        localStorage.removeItem(HUB_SESSION_KEY);
      }
    } catch {
      localStorage.removeItem(HUB_SESSION_KEY);
    }
  }, []);

  // Persist last-accessed timestamp per module
  const openModule = useCallback((id: AppId) => {
    try {
      const raw = localStorage.getItem(HUB_LAST_ACCESS_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[id] = new Date().toISOString();
      localStorage.setItem(HUB_LAST_ACCESS_KEY, JSON.stringify(map));
    } catch {}
    setActiveModule(id);
  }, []);

  const closeModule = useCallback(() => setActiveModule(null), []);

  // Shortcuts
  useShortcuts({
    onTogglePalette: () => setPaletteOpen((o) => !o),
    onEscape: () => {
      if (paletteOpen) setPaletteOpen(false);
      else if (activeModule) closeModule();
    },
    onBack: () => {
      if (paletteOpen) setPaletteOpen(false);
      else if (activeModule) closeModule();
    }
  });

  async function login(username: string, password: string): Promise<void> {
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
    setSession(s);
  }

  const logout = useCallback(() => {
    localStorage.removeItem(HUB_SESSION_KEY);
    setSession(null);
    setActiveModule(null);
  }, []);

  // Render
  if (!session) return <LoginForm onLogin={login} />;

  if (activeModule) {
    const app = APPS.find((a) => a.id === activeModule)!;
    const result = health?.results.find((r) => r.id === app.id);
    return <ModuleView app={app} session={session} result={result} onBack={closeModule} onLogout={logout} />;
  }

  return (
    <>
      <Dashboard
        session={session}
        health={health}
        history={history}
        loading={loading}
        apps={APPS}
        onOpen={openModule}
        onOpenPalette={() => setPaletteOpen(true)}
        onRefresh={refresh}
        onLogout={logout}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        apps={APPS}
        results={health?.results ?? []}
        onSelect={(id) => {
          openModule(id);
          setPaletteOpen(false);
        }}
      />
    </>
  );
}