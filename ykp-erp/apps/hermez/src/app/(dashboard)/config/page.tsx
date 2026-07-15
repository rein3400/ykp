"use client";

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Badge } from "@ykp/ui";

interface ConfigRow {
  configId: string;
  key: string;
  value: string;
  updatedAt: string;
  updatedBy: string | null;
}

interface LabelEntry {
  label: string;
  unit: string;
  description: string;
  severity: "warning" | "critical";
}

const LABEL_MAP: Record<string, LabelEntry> = {
  late_staff_warning_ratio: {
    label: "Rasio Staf Terlambat (Warning)",
    unit: "%",
    description: "Persentase staf terlambat yang memicu warning",
    severity: "warning",
  },
  late_staff_critical_ratio: {
    label: "Rasio Staf Terlambat (Critical)",
    unit: "%",
    description: "Persentase staf terlambat yang memicu critical",
    severity: "critical",
  },
  cash_diff_warning: {
    label: "Selisih Kas (Warning)",
    unit: "IDR",
    description: "Batas selisih kas yang memicu warning",
    severity: "warning",
  },
  cash_diff_critical: {
    label: "Selisih Kas (Critical)",
    unit: "IDR",
    description: "Batas selisih kas yang memicu critical",
    severity: "critical",
  },
  petty_cash_anomaly_multiplier: {
    label: "Anomali Kas Kecil",
    unit: "x",
    description: "Multiplier rata-rata untuk deteksi anomali petty cash",
    severity: "warning",
  },
  high_expense_multiplier: {
    label: "Pengeluaran Tinggi",
    unit: "x",
    description: "Multiplier rata-rata untuk deteksi expense tidak wajar",
    severity: "warning",
  },
};

const DEFAULT_KEYS = Object.keys(LABEL_MAP);

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
          <CardTitle className="text-base">Threshold Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat config...</p>
          ) : (
            allKeys.map((key) => {
              const meta = LABEL_MAP[key];
              const displayLabel = meta?.label ?? key;
              const displayUnit = meta?.unit ?? "";
              const displayDesc = meta?.description ?? "";
              const severity = meta?.severity ?? "warning";

              return (
                <div
                  key={key}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{displayLabel}</span>
                        <Badge variant={severity === "critical" ? "destructive" : "warning"}>
                          {severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{displayDesc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        value={draft[key] ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                        placeholder="value"
                        className="pr-12"
                      />
                      {displayUnit ? (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {displayUnit}
                        </span>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => save(key)}
                      disabled={saving === key}
                    >
                      {saving === key ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}