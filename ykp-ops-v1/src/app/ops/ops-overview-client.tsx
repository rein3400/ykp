"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatIdr } from "@/lib/format";

interface SummaryRow {
  summary_id?: string;
  date?: string;
  outlet_name?: string;
  outlet_id?: string;
  opening_completion_percentage?: string;
  orders_over_sla?: string;
  avg_qc_score?: string;
  incident_count?: string;
  cash_difference?: string;
  major_ops_issue?: string;
}

export interface OpsKpi {
  summaryRows: number;
  openIncidents: number;
  overSla: number;
  openingItems: number;
}

const NAV = [
  ["/ops/opening", "Opening"],
  ["/ops/kds", "KDS"],
  ["/ops/incidents", "Incidents"],
  ["/ops/closing", "Closing"],
  ["/ops/waste", "Waste"],
  ["/ops/checklist", "Checklist"],
] as const;

export default function OpsOverviewClient(props: {
  initialSummaries: SummaryRow[];
  initialKpi: OpsKpi;
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState<SummaryRow[]>(props.initialSummaries);
  const [kpi, setKpi] = React.useState<OpsKpi>(props.initialKpi);
  const [busy, setBusy] = React.useState(false);

  // Sinkron saat server re-fetch (router.refresh()).
  React.useEffect(() => {
    setRows(props.initialSummaries);
    setKpi(props.initialKpi);
  }, [props.initialSummaries, props.initialKpi]);

  const regenerate = async () => {
    setBusy(true);
    try {
      await fetch("/api/ops/summary/regenerate", { method: "POST" });
      router.refresh();
    } catch {
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ringkasan Operational</h1>
          <p className="text-sm text-slate-500">Kondisi outlet hari ini — siap dibaca Hermez.</p>
        </div>
        <button
          type="button"
          onClick={regenerate}
          disabled={busy}
          className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          aria-label="Sarankan ulang summary ops hari ini"
        >
          {busy ? "Menyegarkan…" : "Sarankan ulang hari ini"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Summary rows" value={String(kpi.summaryRows)} />
        <Kpi label="Open incidents" value={String(kpi.openIncidents)} tone={kpi.openIncidents > 0 ? "warn" : "ok"} />
        <Kpi label="Orders over SLA" value={String(kpi.overSla)} tone={kpi.overSla > 0 ? "warn" : "ok"} />
        <Kpi label="Opening items" value={String(kpi.openingItems)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
            {label}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 font-semibold">Daily Summary (latest)</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            Belum ada summary. Generate dari Analytics atau tombol “Sarankan ulang hari ini”.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Outlet</th>
                  <th className="py-2 pr-3">Open %</th>
                  <th className="py-2 pr-3">Over SLA</th>
                  <th className="py-2 pr-3">QC</th>
                  <th className="py-2 pr-3">Incident</th>
                  <th className="py-2 pr-3">Cash Δ</th>
                  <th className="py-2">Issue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.summary_id || `${r.date}|${r.outlet_id}`} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs">{r.date}</td>
                    <td className="py-2 pr-3">{r.outlet_name || r.outlet_id}</td>
                    <td className="py-2 pr-3">{r.opening_completion_percentage}%</td>
                    <td className="py-2 pr-3">{r.orders_over_sla}</td>
                    <td className="py-2 pr-3">{r.avg_qc_score}</td>
                    <td className="py-2 pr-3">{r.incident_count}</td>
                    <td className="py-2 pr-3">{formatIdr(r.cash_difference)}</td>
                    <td className="py-2 text-xs text-slate-600">{r.major_ops_issue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = "ok" }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${tone === "warn" ? "border-amber-300" : ""}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}