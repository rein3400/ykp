"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";

interface Adjustment {
  adjustment_id: string;
  date: string;
  employee_id: string;
  employee_name?: string;
  adjustment_type?: string;
  category?: string;
  type?: string;
  amount: string;
  reason: string;
  payroll_period: string;
  approval_status: string;
  approved_by?: string;
}

export function AdjustmentsTable({ data: initial }: { data: Adjustment[] }) {
  const router = useRouter();
  const [rows, setRows] = React.useState<Adjustment[]>(initial);
  const [busy, setBusy] = React.useState(false);

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setBusy(true);
    try {
      const r = await fetch("/api/hr/adjustments/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adjustment_id: id, decision }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      }
      setRows((rs) =>
        rs.map((row) =>
          row.adjustment_id === id
            ? { ...row, approval_status: decision === "APPROVE" ? "APPROVED" : "REJECTED", approved_by: "owner" }
            : row
        )
      );
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Belum ada data adjustment.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Tanggal</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Karyawan</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Tipe</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Amount</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Periode</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Alasan</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => {
            const isPending = row.approval_status === "PENDING";
            return (
              <tr key={row.adjustment_id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-sm">{row.date}</td>
                <td className="px-3 py-2 text-sm">{row.employee_name || row.employee_id}</td>
                <td className="px-3 py-2 text-sm">{row.adjustment_type || row.type || row.category || '-'}</td>
                <td className="px-3 py-2 text-sm">{row.amount}</td>
                <td className="px-3 py-2 text-sm">{row.payroll_period}</td>
                <td className="px-3 py-2 text-sm">{row.reason}</td>
                <td className="px-3 py-2 text-sm">
                  <StatusBadge status={row.approval_status} />
                </td>
                <td className="px-3 py-2 text-right">
                  {isPending ? (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => decide(row.adjustment_id, "APPROVE")}
                        disabled={busy}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Setujui
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(row.adjustment_id, "REJECT")}
                        disabled={busy}
                        className="rounded-md border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Tolak
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
