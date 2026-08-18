"use client";

import * as React from "react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../_packages/ui/src";
import { fetchBrief, runBrief } from "../api/service";
import type { BriefRow } from "../api/types";

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

export function DailyBriefPanel({ date }: { date?: string }) {
  const [brief, setBrief] = React.useState<BriefRow | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchBrief(date);
      setBrief(res.brief);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBrief(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Daily Brief {brief?.date ? `— ${brief.date}` : ""}</CardTitle>
            <CardDescription>
              {brief ? `Dibuat ${brief.generatedAt ?? "—"} WIB` : "Belum ada brief"}
            </CardDescription>
          </div>
          {brief ? (
            <Badge variant={levelVariant(brief.alertLevel)} className="uppercase">
              {brief.alertLevel}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Error: {error}</p>
        ) : brief ? (
          <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-4 font-mono text-sm">
            {brief.briefText}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">
            Belum ada brief. Generate via Run Console.
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void runBrief(date)}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Generate ulang
          </button>
        </div>
      </CardContent>
    </Card>
  );
}