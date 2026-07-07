"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from "@ykp/ui";

interface BriefRow {
  briefId: string;
  date: string;
  alertLevel: "green" | "yellow" | "red";
  briefText: string;
  sentToOwner: boolean;
  generatedAt: string;
}

function levelVariant(level: BriefRow["alertLevel"]) {
  switch (level) {
    case "red":
      return "destructive" as const;
    case "yellow":
      return "warning" as const;
    case "green":
    default:
      return "success" as const;
  }
}

export default function DailyBriefPage() {
  const [date, setDate] = React.useState<string>(() => new Date().toISOString().slice(0, 10));
  const [brief, setBrief] = React.useState<BriefRow | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchBrief = React.useCallback(async (target: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hermez/brief?date=${encodeURIComponent(target)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setBrief(json.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBrief(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchBrief(date);
  }, [date, fetchBrief]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Daily Brief</h2>
          <p className="text-sm text-muted-foreground">
            Brief harian hasil baca summary HR + Finance + 7 trigger Hermez.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="brief-date">
            Tanggal
          </label>
          <input
            id="brief-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Memuat brief...</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">Error: {error}</CardContent>
        </Card>
      ) : brief ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Brief {brief.date}</CardTitle>
                <CardDescription>
                  Dibuat {brief.generatedAt} WIB
                  {brief.sentToOwner ? " · terkirim ke Telegram" : " · belum terkirim"}
                </CardDescription>
              </div>
              <Badge variant={levelVariant(brief.alertLevel)} className="uppercase">
                {brief.alertLevel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-4 font-mono text-sm">
              {brief.briefText}
            </pre>
            <div className="mt-4 flex gap-2">
              <a
                href={`/alerts?date=${brief.date}`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Lihat alert log untuk {brief.date}
              </a>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Belum ada brief untuk tanggal {date}. Generate via Run Console.
          </CardContent>
        </Card>
      )}
    </div>
  );
}