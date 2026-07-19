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

interface RunJob {
  job_id: string;
  date: string;
  status: "RUNNING" | "DONE" | "FAILED" | "STALE";
  started_at: string;
  finished_at?: string;
  result?: { brief_id: string; alert_count: number; level: RunResult["level"] };
  error?: string;
}

const POLL_MS = 2000;
const MAX_POLLS = 60; // 2 minutes

export default function RunConsolePage() {
  const [date, setDate] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = React.useState(false);
  const [job, setJob] = React.useState<RunJob | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed-seconds ticker while RUNNING for honest progress feedback.
  React.useEffect(() => {
    if (job?.status !== "RUNNING") return;
    const started = new Date(job.started_at).getTime();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [job?.status, job?.started_at]);

  React.useEffect(() => () => stopPolling(), []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function pollJob(jobDate: string) {
    stopPolling();
    let n = 0;
    pollRef.current = setInterval(async () => {
      n += 1;
      try {
        const res = await fetch(`/api/hermez/run?date=${jobDate}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
        const j = json.data as RunJob;
        setJob(j);
        if (j.status !== "RUNNING" || n >= MAX_POLLS) {
          stopPolling();
          setSubmitting(false);
          if (j.status === "FAILED" || j.status === "STALE") {
            setError(j.error ?? `Job ${j.status.toLowerCase()}`);
          }
        }
      } catch (e) {
        stopPolling();
        setSubmitting(false);
        setError(e instanceof Error ? e.message : String(e));
      }
    }, POLL_MS);
  }

  async function trigger() {
    setSubmitting(true);
    setError(null);
    setJob(null);
    setElapsed(0);
    try {
      const res = await fetch("/api/hermez/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 202) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      const j = json.data as RunJob;
      setJob(j);
      if (j.status === "RUNNING") {
        await pollJob(j.date);
      } else {
        // DONE (cached) or FAILED/STALE immediately
        setSubmitting(false);
        if (j.status === "FAILED" || j.status === "STALE") setError(j.error ?? `Job ${j.status.toLowerCase()}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  const result: RunResult | null = job?.status === "DONE" && job.result
    ? { brief_id: job.result.brief_id, date: job.date, alert_count: job.result.alert_count, level: job.result.level }
    : null;

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
              {submitting ? `Generating… ${elapsed}s` : "Generate brief"}
            </Button>
          </div>

          {job?.status === "RUNNING" ? (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Brief sedang dibuat di background (job <code>{job.job_id}</code>)… {elapsed}s elapsed.
                Halaman ini bisa ditinggal — status tersimpan di server.
              </p>
            </div>
          ) : null}

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
