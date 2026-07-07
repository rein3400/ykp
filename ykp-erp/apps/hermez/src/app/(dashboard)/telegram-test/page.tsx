"use client";

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@ykp/ui";

export default function TelegramTestPage() {
  const [message, setMessage] = React.useState("🧠 YKP Hermez test message");
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<{ sent: boolean; error?: string; messageId?: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function send() {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/hermez/telegram/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setResult(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Telegram Test</h2>
        <p className="text-sm text-muted-foreground">
          Kirim pesan test ke owner chat via engine.sendTelegramMessage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pesan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full rounded-md border bg-background p-2 font-mono text-sm"
          />
          <Button onClick={send} disabled={submitting || !message}>
            {submitting ? "Mengirim..." : "Kirim"}
          </Button>
          {error ? <p className="text-sm text-destructive">Error: {error}</p> : null}
          {result ? (
            <p className="text-sm">
              {result.sent ? (
                <span className="text-success">Terkirim (message_id: {result.messageId})</span>
              ) : (
                <span className="text-destructive">Gagal: {result.error}</span>
              )}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}