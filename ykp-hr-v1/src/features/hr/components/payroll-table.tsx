"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/components/toast";

interface Payroll {
  payroll_id: string;
  payroll_period: string;
  employee_id: string;
  employee_name: string;
  basic_salary: string;
  net_salary: string;
  approval_status: string;
  payment_status: string;
  locked_status?: string;
  locked_at?: string;
  locked_by?: string;
  unlock_reason?: string;
  unlock_approved_by?: string;
  approved_by?: string;
  payment_reference?: string;
}

export function PayrollTable({
  data: initial,
  userRole
}: {
  data: Payroll[];
  userRole?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  // Keep client state in sync when server re-fetches after router.refresh().
  const [rows, setRows] = React.useState<Payroll[]>(initial);
  React.useEffect(() => {
    setRows(initial);
  }, [initial]);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [paymentRef, setPaymentRef] = React.useState("");
  const [paymentRefErr, setPaymentRefErr] = React.useState("");
  const [unlockId, setUnlockId] = React.useState<string | null>(null);
  const [unlockReason, setUnlockReason] = React.useState("");
  const [unlockErr, setUnlockErr] = React.useState("");

  const canUnlock = userRole === "owner" || userRole === "super_admin";

  async function approve(id: string) {
    setBusyId(id);
    try {
      const r = await fetch("/api/hr/payroll/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payroll_id: id, decision: "APPROVE" }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      }
      setRows((rs) =>
        rs.map((row) =>
          row.payroll_id === id ? { ...row, approval_status: "APPROVED", approved_by: "owner" } : row
        )
      );
      toast.success("Payroll disetujui");
      router.refresh();
    } catch (e) {
      toast.error("Gagal approve payroll", e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setBusyId(null);
    }
  }

  function toggleMarkPaid(id: string) {
    setExpandedId(expandedId === id ? null : id);
    setPaymentRef("");
    setPaymentRefErr("");
  }

  async function markPaid(id: string) {
    if (!paymentRef.trim()) {
      setPaymentRefErr("Payment reference wajib diisi.");
      return;
    }
    setPaymentRefErr("");
    setBusyId(id);
    try {
      const r = await fetch("/api/hr/payroll/mark-paid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payroll_id: id, payment_reference: paymentRef }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      }
      const j = await r.json().catch(() => ({}));
      const locked = j?.data?.locked_status === "LOCKED";
      setRows((rs) =>
        rs.map((row) =>
          row.payroll_id === id
            ? {
                ...row,
                payment_status: "PAID",
                payment_reference: paymentRef,
                locked_status: locked ? "LOCKED" : row.locked_status,
                locked_at: j?.data?.locked_at ?? row.locked_at,
                locked_by: j?.data?.locked_by ?? row.locked_by
              }
            : row
        )
      );
      setExpandedId(null);
      setPaymentRef("");
      toast.success("Payroll ditandai dibayar");
      router.refresh();
    } catch (e) {
      toast.error("Gagal menandai dibayar", e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setBusyId(null);
    }
  }

  function toggleUnlock(id: string) {
    setUnlockId(unlockId === id ? null : id);
    setUnlockReason("");
    setUnlockErr("");
  }

  async function confirmUnlock(id: string) {
    if (!unlockReason.trim()) {
      setUnlockErr("Alasan unlock wajib diisi.");
      return;
    }
    setUnlockErr("");
    setBusyId(id);
    try {
      const r = await fetch("/api/hr/payroll/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payroll_id: id, reason: unlockReason }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
      }
      setRows((rs) =>
        rs.map((row) =>
          row.payroll_id === id
            ? {
                ...row,
                locked_status: "UNLOCKED",
                unlock_reason: unlockReason,
                unlock_approved_by: "me"
              }
            : row
        )
      );
      setUnlockId(null);
      setUnlockReason("");
      toast.success("Payroll berhasil di-unlock");
      router.refresh();
    } catch (e) {
      toast.error("Gagal unlock payroll", e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Belum ada data payroll.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Karyawan</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Gaji Pokok</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Net</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Approval</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Bayar</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Lock</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => {
            const isPending = row.approval_status === "PENDING";
            const isApproved = row.approval_status === "APPROVED";
            const isUnpaid = row.payment_status !== "PAID";
            const isExpanded = expandedId === row.payroll_id;
            const isLocked = row.locked_status === "LOCKED";
            const isUnlockExpanded = unlockId === row.payroll_id;
            return (
              <React.Fragment key={row.payroll_id}>
                <tr className={`hover:bg-slate-50${isLocked ? " bg-amber-50/50" : ""}`}>
                  <td className="px-3 py-2 text-sm">{row.employee_name} <span className="text-slate-400 text-xs">({row.employee_id})</span></td>
                  <td className="px-3 py-2 text-sm">{row.basic_salary}</td>
                  <td className="px-3 py-2 text-sm font-semibold">{row.net_salary}</td>
                  <td className="px-3 py-2 text-sm">
                    <StatusBadge status={row.approval_status} />
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <StatusBadge status={row.payment_status} />
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {isLocked ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200" title={row.locked_at ? `Locked at ${row.locked_at}` : undefined}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 1a4 4 0 00-4 4v2H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-1V5a4 4 0 00-4-4zm2 6V5a2 2 0 10-4 0v2h4z" clipRule="evenodd" />
                        </svg>
                        LOCKED
                      </span>
                    ) : row.locked_status === "UNLOCKED" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500" title={row.unlock_reason ? `Unlocked: ${row.unlock_reason}` : undefined}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path d="M10 1a4 4 0 00-4 4v2H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-1V5a4 4 0 00-4-4zm-2 6V5a2 2 0 112 0v2H8z" />
                        </svg>
                        unlocked
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {isPending && !isLocked && (
                        <button
                          type="button"
                          onClick={() => approve(row.payroll_id)}
                          disabled={busyId !== null}
                          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busyId === row.payroll_id ? "…" : "Setujui"}
                        </button>
                      )}
                      {isApproved && isUnpaid && !isLocked && (
                        <button
                          type="button"
                          onClick={() => toggleMarkPaid(row.payroll_id)}
                          disabled={busyId !== null}
                          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Tandai Dibayar
                        </button>
                      )}
                      {isLocked && canUnlock && (
                        <button
                          type="button"
                          onClick={() => toggleUnlock(row.payroll_id)}
                          disabled={busyId !== null}
                          className="rounded-md border border-amber-400 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                        >
                          Unlock
                        </button>
                      )}
                      {isLocked && !canUnlock && (
                        <span className="text-xs text-slate-400" title="Hanya owner/super_admin yang dapat unlock">locked</span>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-blue-50">
                    <td colSpan={7} className="px-3 py-3">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-blue-800">Payment reference (mis: TRF-2026-07-001)</label>
                        <input
                          value={paymentRef}
                          onChange={(e) => setPaymentRef(e.target.value)}
                          className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm"
                          placeholder="TRF-2026-07-001"
                        />
                        {paymentRefErr && <div className="text-sm text-rose-600">{paymentRefErr}</div>}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => markPaid(row.payroll_id)}
                            disabled={busyId !== null}
                            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {busyId === row.payroll_id ? "…" : "Konfirmasi"}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleMarkPaid(row.payroll_id)}
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
                {isUnlockExpanded && (
                  <tr className="bg-amber-50">
                    <td colSpan={7} className="px-3 py-3">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-amber-800">Alasan unlock payroll (wajib, tercatat di audit log)</label>
                        <textarea
                          value={unlockReason}
                          onChange={(e) => setUnlockReason(e.target.value)}
                          rows={2}
                          className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm"
                          placeholder="Mis: koreksi salah perhitungan, data belum final"
                        />
                        {unlockErr && <div className="text-sm text-rose-600">{unlockErr}</div>}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => confirmUnlock(row.payroll_id)}
                            disabled={busyId !== null}
                            className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                          >
                            {busyId === row.payroll_id ? "…" : "Konfirmasi Unlock"}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleUnlock(row.payroll_id)}
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