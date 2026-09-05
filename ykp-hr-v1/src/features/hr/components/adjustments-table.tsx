"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/components/toast";

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
  const toast = useToast();
  // Keep client state in sync when server re-fetches after router.refresh()
  // (useState(initial) alone is only used on first mount — new rows would vanish).
  const [rows, setRows] = React.useState<Adjustment[]>(initial);
  React.useEffect(() => {
    setRows(initial);
  }, [initial]);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setBusyId(id);
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
      toast.success(decision === "APPROVE" ? "Adjustment disetujui" : "Adjustment ditolak");
      router.refresh();
    } catch (e) {
      toast.error("Gagal memproses", e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setBusyId(null);
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
                        disabled={busyId !== null}
                        className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busyId === row.adjustment_id ? "…" : "Setujui"}
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(row.adjustment_id, "REJECT")}
                        disabled={busyId !== null}
                        className="rounded-md border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Tolak
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
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
