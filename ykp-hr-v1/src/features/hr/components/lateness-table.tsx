"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { formatIdr } from "@/lib/format";
import { useToast } from "@/components/toast";

export interface LatenessRow {
  lateness_id: string;
  date: string;
  employee_id: string;
  employee_name?: string;
  late_minutes: string;
  tolerance_minutes: string;
  payable_late_minutes: string;
  penalty_amount: string;
  reason?: string;
  approval_status: string;
  approved_by?: string;
}

export function LatenessTable({ data: initial }: { data: LatenessRow[] }) {
  const router = useRouter();
  const toast = useToast();
  // Keep client state in sync when server re-fetches after router.refresh().
  const [rows, setRows] = React.useState<LatenessRow[]>(initial);
  React.useEffect(() => {
    setRows(initial);
  }, [initial]);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [err, setErr] = React.useState("");

  function toggleReject(id: string) {
    setExpandedId(expandedId === id ? null : id);
    setReason("");
    setErr("");
  }

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    if (decision === "REJECT" && !reason.trim()) {
      setErr("Alasan penolakan wajib diisi.");
      return;
    }
    setBusyId(id);
    setErr("");
    try {
      const r = await fetch("/api/hr/lateness/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lateness_id: id, decision, reason }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      }
      // Optimistic update
      setRows((rs) =>
        rs.map((row) =>
          row.lateness_id === id
            ? { ...row, approval_status: decision === "APPROVE" ? "APPROVED" : "REJECTED" }
            : row
        )
      );
      setExpandedId(null);
      setReason("");
      toast.success(decision === "APPROVE" ? "Denda disetujui" : "Denda ditolak");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal";
      setErr(msg);
      toast.error("Gagal memproses", msg);
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Belum ada baris keterlambatan. Generate via absensi LATE atau dari summary.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Tanggal</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Karyawan</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Telat (m)</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Toleransi (m)</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Payable (m)</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Denda</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => {
            const status = (row.approval_status || "PENDING").toUpperCase();
            const isPending = status === "PENDING";
            const isExpanded = expandedId === row.lateness_id;
            return (
              <React.Fragment key={row.lateness_id}>
                <tr className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{row.date}</td>
                  <td className="px-3 py-2 text-sm">{row.employee_name || row.employee_id}</td>
                  <td className="px-3 py-2 text-right text-sm">{row.late_minutes || "0"}</td>
                  <td className="px-3 py-2 text-right text-sm">{row.tolerance_minutes || "0"}</td>
                  <td className="px-3 py-2 text-right text-sm">{row.payable_late_minutes || "0"}</td>
                  <td className="px-3 py-2 text-right text-sm">{formatIdr(row.penalty_amount || "0")}</td>
                  <td className="px-3 py-2 text-sm">
                    <StatusBadge status={status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isPending ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => decide(row.lateness_id, "APPROVE")}
                          disabled={busyId !== null}
                          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busyId === row.lateness_id ? "…" : "Setujui"}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleReject(row.lateness_id)}
                          disabled={busyId !== null}
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
                {isExpanded && (
                  <tr className="bg-rose-50">
                    <td colSpan={8} className="px-3 py-3">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-rose-800">Alasan penolakan</label>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          rows={2}
                          className="w-full rounded-md border border-rose-300 bg-white px-3 py-2 text-sm"
                          placeholder="Wajib diisi, mis: denda tidak sesuai rule / data absensi keliru"
                        />
                        {err && <p className="text-xs text-rose-600">{err}</p>}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => decide(row.lateness_id, "REJECT")}
                            disabled={busyId !== null}
                            className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            {busyId === row.lateness_id ? "…" : "Konfirmasi Tolak"}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleReject(row.lateness_id)}
                            disabled={busyId !== null}
                            className="rounded-md border border-slate-300 px-3 py-1 text-xs"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
