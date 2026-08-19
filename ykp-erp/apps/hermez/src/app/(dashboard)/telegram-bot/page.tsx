"use client";

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from "@ykp/ui";

interface BotStatus {
  running: boolean;
  mode: "polling" | "stopped";
  lastUpdateId: number;
  lastError: string | null;
  startedAt: string | null;
  messagesHandled: number;
}

export default function TelegramBotPage() {
  const [status, setStatus] = React.useState<BotStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [acting, setActing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hermez/telegram/bot", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setStatus(json.data?.bot ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function act(action: "start" | "stop") {
    setActing(true);
    setError(null);
    try {
      const res = await fetch("/api/hermez/telegram/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setStatus(json.data?.bot ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Telegram Bot</h2>
        <p className="text-sm text-muted-foreground">
          Bot dialog dua arah: /brief /omzet /hr /alerts /sop + tanya AI bebas.
          Credentials dari Konfigurasi → Integrasi.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">Error: {error}</p> : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Status Bot</CardTitle>
            {status ? (
              <Badge variant={status.running ? "success" : "warning"}>
                {status.running ? "polling aktif" : "berhenti"}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && !status ? (
            <p className="text-sm text-muted-foreground">Memuat status...</p>
          ) : status ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Mode</dt>
              <dd className="font-mono">{status.mode}</dd>
              <dt className="text-muted-foreground">Started</dt>
              <dd className="font-mono">{status.startedAt ?? "-"}</dd>
              <dt className="text-muted-foreground">Messages handled</dt>
              <dd className="font-mono">{status.messagesHandled}</dd>
              <dt className="text-muted-foreground">Last update id</dt>
              <dd className="font-mono">{status.lastUpdateId}</dd>
              {status.lastError ? (
                <>
                  <dt className="text-muted-foreground">Last error</dt>
                  <dd className="font-mono text-destructive">{status.lastError}</dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Status tidak tersedia.</p>
          )}
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={() => act("start")} disabled={acting || status?.running}>
              Start polling
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => act("stop")}
              disabled={acting || !status?.running}
            >
              Stop
            </Button>
            <Button size="sm" variant="ghost" onClick={() => refresh()} disabled={loading}>
              Refresh
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Catatan: worker container dedicated belum di-deploy di prod. Klik
            &quot;Start polling&quot; untuk jalankan bot dialog in-process di web
            service (valid untuk demo; restart container akan stop lagi).
            Whitelist: OWNER_CHAT_ID (comma-list) + OWNER_USER_IDS (DM owner).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
