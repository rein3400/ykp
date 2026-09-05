"use client";
import { useEffect, useState, useCallback } from "react";
import { APPS, ssoUrl, type AppId } from "./components/apps";
import { LoginForm } from "./components/login-form";
import { Dashboard } from "./components/dashboard";
import { ModuleView } from "./components/module-view";
import { CommandPalette } from "./components/command-palette";
import { openAppUrl } from "./components/open-app";
import { useHealth } from "./hooks/use-health";
import { useShortcuts } from "./hooks/use-shortcuts";

const HUB_LAST_ACCESS_KEY = "ykp_hub_last_access";

interface HubSession {
  username: string;
  role: string;
  userId: string;
}

export default function HubDashboard() {
  const [session, setSession] = useState<HubSession | null>(null);
  const [ready, setReady] = useState(false);
  const [activeModule, setActiveModule] = useState<AppId | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const { health, history, loading, refresh } = useHealth(30_000);

  // Restore session from the httpOnly cookie (never localStorage — XSS
  // could steal a script-readable session credential).
  useEffect(() => {
    if (typeof window === "undefined") return;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const d = j?.data;
        if (d?.username) {
          setSession({
            username: String(d.username),
            role: String(d.role ?? "VIEWER"),
            userId: String(d.userId ?? d.username)
          });
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // Persist last-accessed timestamp per module
  const openModule = useCallback((id: AppId) => {
    try {
      const raw = localStorage.getItem(HUB_LAST_ACCESS_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[id] = new Date().toISOString();
      localStorage.setItem(HUB_LAST_ACCESS_KEY, JSON.stringify(map));
    } catch {}
    // Cross-origin iframes can't reliably receive the ERP app's session
    // cookie in modern browsers (third-party cookie blocking), so the
    // "Preview" action opens the app in a new tab via the SSO bridge
    // (auto-login) instead of an embedded iframe. The cookie is set in a
    // top-level navigation, which browsers always allow.
    const app = APPS.find((a) => a.id === id);
    if (app) openAppUrl(ssoUrl(app, session?.role ?? "OWNER"));
  }, [session]);

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

  /** Open a module in a new tab (cross-origin iframes can't reliably
   *  receive the ERP session cookie in modern browsers — third-party
   *  cookie blocking — so Preview opens the SSO bridge in a top-level
   *  tab, exactly like Buka). */
  const previewModule = useCallback((id: AppId) => {
    try {
      const raw = localStorage.getItem(HUB_LAST_ACCESS_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[id] = new Date().toISOString();
      localStorage.setItem(HUB_LAST_ACCESS_KEY, JSON.stringify(map));
    } catch {}
    // Cross-origin iframes can't reliably receive the ERP app's session
    // cookie in modern browsers (third-party cookie blocking), so the
    // "Preview" action opens the app in a new tab via the SSO bridge
    // (auto-login) instead of an embedded iframe. The cookie is set in a
    // top-level navigation, which browsers always allow.
    const app = APPS.find((a) => a.id === id);
    if (app) openAppUrl(ssoUrl(app, session?.role ?? "OWNER"));
  }, [session]);

  async function login(username: string, password: string): Promise<void> {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(j?.error?.message ?? `Login gagal (HTTP ${r.status})`);
    }
    // Session lives in the httpOnly cookie set by the API — keep only
    // display fields in memory, nothing credential-like in localStorage.
    const d = j?.data ?? {};
    setSession({
      username,
      role: (d.role ?? "VIEWER").toString().toUpperCase(),
      userId: (d.userId ?? username).toString()
    });
  }

  const logout = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession(null);
    setActiveModule(null);
  }, []);

  // Render
  if (!ready) return null;
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
        onPreview={previewModule}
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
          previewModule(id);
          setPaletteOpen(false);
        }}
      />
    </>
  );
}