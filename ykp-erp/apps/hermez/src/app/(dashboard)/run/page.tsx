"use client";

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@ykp/ui";

interface RunResult {
  brief_id: string;
  date: string;
  alert_count: number;
  level: "green" | "yellow" | "red";
  telegram?: {
    attempted: boolean;
    sent: boolean;
    skipped?: string;
    messageId?: number;
    error?: string;
  };
}

export default function RunConsolePage() {
  const [date, setDate] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<RunResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function trigger() {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/hermez/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date }),
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
        <h2 className="text-2xl font-semibold tracking-tight">Run Console</h2>
        <p className="text-sm text-muted-foreground">
          Trigger generateBriefForDate manual. Hanya super-admin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trigger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-sm" htmlFor="run-date">
                Tanggal (WIB)
              </label>
              <Input
                id="run-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <Button onClick={trigger} disabled={submitting || !date}>
              {submitting ? "Generating..." : "Generate brief"}
            </Button>
          </div>
          {error ? (
            <p className="text-sm text-destructive">Error: {error}</p>
          ) : null}
          {result ? (
            <div className="rounded-md border bg-muted/30 p-4 text-sm">
              <p>
                <strong>brief_id:</strong> <code>{result.brief_id}</code>
              </p>
              <p>
                <strong>date:</strong> {result.date}
              </p>
              <p>
                <strong>alert_count:</strong> {result.alert_count}
              </p>
              <p>
                <strong>level:</strong> {result.level}
              </p>
              {result.telegram ? (
                <p>
                  <strong>telegram:</strong>{" "}
                  {result.telegram.sent
                    ? `Terkirim${result.telegram.messageId != null ? ` (message_id: ${result.telegram.messageId})` : ""}`
                    : result.telegram.skipped
                      ? `skip (${result.telegram.skipped})`
                      : `gagal${result.telegram.error ? `: ${result.telegram.error}` : ""}`}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}