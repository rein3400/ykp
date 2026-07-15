/**
 * Hermez Warehouse view — read-only summary + alerts from ykp-warehouse-v1.
 * Brief §22: Hermez reads warehouse_daily_summary + HIGH/CRITICAL alerts.
 */
"use client";

import { useEffect, useState } from "react";

interface Summary {
  date?: string;
  total_inventory_value?: string;
  critical_low_stock_count?: string;
  stockout_risk_count?: string;
  waste_value?: string;
  unexplained_variance_value?: string;
  near_expiry_item_count?: string;
  open_action_count?: string;
  major_warehouse_issue?: string;
  recommended_action?: string;
  generated_at?: string;
}

interface Alert {
  alert_id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  action_required?: string;
}

export default function HermezWarehousePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [sRes, aRes] = await Promise.all([
          fetch("/api/hermez/warehouse-summary"),
          fetch("/api/hermez/warehouse-alerts?severity=HIGH&status=OPEN"),
        ]);
        const sJson = await sRes.json();
        const aJson = await aRes.json();
        if (sJson.error && !sJson.data) {
          setError(sJson.error.message);
        } else {
          // summary may be array or single object
          const d = sJson.data;
          if (Array.isArray(d)) setSummary(d[0] ?? null);
          else if (d?.items) setSummary(d.items[0] ?? null);
          else setSummary(d);
        }
        const items = aJson.data?.items ?? aJson.data ?? [];
        setAlerts(Array.isArray(items) ? items : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load warehouse data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading warehouse summary…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Warehouse Summary</h1>
        <p className="text-sm text-muted-foreground">
          Read-only dari ykp-warehouse-v1. Hermez tidak mengubah stock ledger.
        </p>
      </div>

      {error && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Warehouse belum terhubung: {error}
          <br />
          Set env <code>WAREHOUSE_SUMMARY_URL</code> / pastikan warehouse running di :3005.
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card label="Inventory Value" value={formatRp(summary.total_inventory_value)} />
          <Card label="Critical Low Stock" value={summary.critical_low_stock_count ?? "0"} />
          <Card label="Stockout Risk" value={summary.stockout_risk_count ?? "0"} />
          <Card label="Waste Value" value={formatRp(summary.waste_value)} />
          <Card label="Unexplained Variance" value={formatRp(summary.unexplained_variance_value)} />
          <Card label="Near Expiry" value={summary.near_expiry_item_count ?? "0"} />
          <Card label="Open Actions" value={summary.open_action_count ?? "0"} />
          <Card label="Generated" value={summary.generated_at ?? summary.date ?? "—"} />
        </div>
      )}

      {summary?.major_warehouse_issue && (
        <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-semibold text-destructive">Major Issue</p>
          <p>{summary.major_warehouse_issue}</p>
          {summary.recommended_action && (
            <p className="mt-1 text-xs">Action: {summary.recommended_action}</p>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold">HIGH/CRITICAL Alerts (OPEN)</h2>
        {alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Tidak ada alert HIGH/CRITICAL open.</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <div
                key={a.alert_id}
                className={`rounded border p-3 text-xs ${
                  a.severity === "CRITICAL"
                    ? "border-red-400 bg-red-50"
                    : "border-orange-300 bg-orange-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.alert_type?.replace(/_/g, " ")}</span>
                  <span className="rounded bg-white/80 px-1 text-[10px] font-medium">{a.severity}</span>
                </div>
                <p className="mt-1 font-medium">{a.title}</p>
                <p className="text-muted-foreground">{a.message}</p>
                {a.action_required && (
                  <p className="mt-1 text-primary">Action: {a.action_required}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-background p-3">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function formatRp(n?: string) {
  const v = Number(n || 0);
  if (!v) return "Rp 0";
  return `Rp ${new Intl.NumberFormat("id-ID").format(Math.trunc(v))}`;
}
