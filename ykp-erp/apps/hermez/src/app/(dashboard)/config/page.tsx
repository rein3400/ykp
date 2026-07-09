"use client";

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@ykp/ui";

interface ConfigRow {
  configId: string;
  key: string;
  value: string;
  updatedAt: string;
  updatedBy: string | null;
}

const DEFAULT_KEYS = [
  "late_staff_warning_ratio",
  "late_staff_critical_ratio",
  "cash_diff_warning",
  "cash_diff_critical",
  "petty_cash_anomaly_multiplier",
  "high_expense_multiplier",
];

export default function ConfigPage() {
  const [rows, setRows] = React.useState<ConfigRow[]>([]);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);

  const fetchConfig = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hermez/config");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      const items: ConfigRow[] = json.data?.items ?? [];
      setRows(items);
      setDraft(Object.fromEntries(items.map((r) => [r.key, r.value])));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  async function save(key: string) {
    setSaving(key);
    setError(null);
    try {
      const res = await fetch("/api/hermez/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value: draft[key] ?? "" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      await fetchConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  const allKeys = React.useMemo(() => {
    const keys = new Set<string>([...DEFAULT_KEYS, ...rows.map((r) => r.key)]);
    return Array.from(keys);
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Threshold Config</h2>
        <p className="text-sm text-muted-foreground">
          Tuning parameter trigger Hermez. Hanya super-admin.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          {error?.match(/unauthor/i) || error?.match(/forbidden/i)
            ? "Silakan login untuk mengakses konfigurasi"
            : `Error: ${error}`}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat config...</p>
          ) : (
            allKeys.map((key) => (
              <div
                key={key}
                className="grid grid-cols-1 items-center gap-2 md:grid-cols-[260px,1fr,120px]"
              >
                <code className="rounded bg-muted/40 px-2 py-1 text-xs">{key}</code>
                <Input
                  value={draft[key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  placeholder="value"
                />
                <Button
                  size="sm"
                  onClick={() => save(key)}
                  disabled={saving === key}
                >
                  {saving === key ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}