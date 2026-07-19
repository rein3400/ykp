"use client";

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Badge } from "@ykp/ui";

interface ConfigRow {
  configId: string;
  key: string;
  value: string;
  secret?: boolean;
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

interface IntegrationField {
  key: string;
  label: string;
  description: string;
  placeholder: string;
  secret: boolean;
}

const INTEGRATION_FIELDS: IntegrationField[] = [
  {
    key: "telegram_bot_token",
    label: "Telegram Bot Token",
    description: "Token bot dari @BotFather. Dipakai untuk kirim daily brief & alert.",
    placeholder: "123456:ABC-DEF…",
    secret: true,
  },
  {
    key: "telegram_chat_id",
    label: "Telegram Chat / Group ID",
    description: "Chat atau group ID tujuan brief (contoh: -5437367893).",
    placeholder: "-100xxxxxxxxxx",
    secret: false,
  },
  {
    key: "llm_provider",
    label: "LLM Provider",
    description: "Provider model: openai, anthropic, openrouter, dll.",
    placeholder: "openai",
    secret: false,
  },
  {
    key: "llm_api_key",
    label: "LLM API Key",
    description: "API key provider LLM. Disimpan server-side, ditampilkan masked.",
    placeholder: "sk-…",
    secret: true,
  },
  {
    key: "llm_model",
    label: "LLM Model",
    description: "Nama model (contoh: gpt-4o-mini, claude-haiku-4-5).",
    placeholder: "gpt-4o-mini",
    secret: false,
  },
  {
    key: "llm_base_url",
    label: "LLM Base URL (opsional)",
    description: "Custom endpoint OpenAI-compatible. Kosongkan untuk default provider.",
    placeholder: "https://api.openai.com/v1",
    secret: false,
  },
];

/** Placeholder shown for stored secrets. Typing replaces the stored value. */
const MASK_PLACEHOLDER = "•••• (tersimpan — ketik untuk ganti)";

export default function ConfigPage() {
  const [rows, setRows] = React.useState<ConfigRow[]>([]);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [integrationDraft, setIntegrationDraft] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [integrationMsg, setIntegrationMsg] = React.useState<string | null>(null);

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

  async function saveIntegration(key: string) {
    const value = (integrationDraft[key] ?? "").trim();
    if (!value) {
      setError(`Isi nilai untuk ${key} dulu sebelum menyimpan.`);
      return;
    }
    setSaving(key);
    setError(null);
    setIntegrationMsg(null);
    try {
      const res = await fetch("/api/hermez/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      setIntegrationDraft((d) => ({ ...d, [key]: "" }));
      setIntegrationMsg(`Tersimpan: ${key}`);
      await fetchConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  const allKeys = React.useMemo(() => {
    const integrationKeys = new Set(INTEGRATION_FIELDS.map((f) => f.key));
    const keys = new Set<string>([
      ...DEFAULT_KEYS,
      ...rows.map((r) => r.key).filter((k) => !integrationKeys.has(k)),
    ]);
    return Array.from(keys);
  }, [rows]);

  const integrationStatus = React.useMemo(() => {
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return (key: string) => Boolean(map.get(key));
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
          <CardTitle className="text-base">Integrasi — Telegram &amp; LLM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Nilai di sini menimpa env var server. Secret ditampilkan masked dan hanya diganti
            kalau owner mengetik nilai baru.
          </p>
          {integrationMsg ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{integrationMsg}</p>
          ) : null}
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat config...</p>
          ) : (
            INTEGRATION_FIELDS.map((field) => {
              const stored = integrationStatus(field.key);
              return (
                <div key={field.key} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{field.label}</span>
                        {stored ? (
                          <Badge variant="success">tersimpan</Badge>
                        ) : (
                          <Badge variant="warning">belum di-set</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        type={field.secret ? "password" : "text"}
                        autoComplete="off"
                        value={integrationDraft[field.key] ?? ""}
                        onChange={(e) =>
                          setIntegrationDraft((d) => ({ ...d, [field.key]: e.target.value }))
                        }
                        placeholder={stored && field.secret ? MASK_PLACEHOLDER : field.placeholder}
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => saveIntegration(field.key)}
                      disabled={saving === field.key}
                    >
                      {saving === field.key ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

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