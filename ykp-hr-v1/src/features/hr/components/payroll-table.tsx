"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";

interface Payroll {
  payroll_id: string;
  payroll_period: string;
  employee_id: string;
  employee_name: string;
  basic_salary: string;
  net_salary: string;
  approval_status: string;
  payment_status: string;
  approved_by?: string;
  payment_reference?: string;
}

export function PayrollTable({ data: initial }: { data: Payroll[] }) {
  const router = useRouter();
  const [rows, setRows] = React.useState<Payroll[]>(initial);
  const [busy, setBusy] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [paymentRef, setPaymentRef] = React.useState("");

  async function approve(id: string) {
    setBusy(true);
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
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  function toggleMarkPaid(id: string) {
    setExpandedId(expandedId === id ? null : id);
    setPaymentRef("");
  }

  async function markPaid(id: string) {
    if (!paymentRef.trim()) {
      alert("Payment reference wajib diisi.");
      return;
    }
    setBusy(true);
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
      setRows((rs) =>
        rs.map((row) =>
          row.payroll_id === id
            ? { ...row, payment_status: "PAID", payment_reference: paymentRef }
            : row
        )
      );
      setExpandedId(null);
      setPaymentRef("");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
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
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => {
            const isPending = row.approval_status === "PENDING";
            const isApproved = row.approval_status === "APPROVED";
            const isUnpaid = row.payment_status !== "PAID";
            const isExpanded = expandedId === row.payroll_id;
            return (
              <React.Fragment key={row.payroll_id}>
                <tr className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-sm">{row.employee_name} <span className="text-slate-400 text-xs">({row.employee_id})</span></td>
                  <td className="px-3 py-2 text-sm">{row.basic_salary}</td>
                  <td className="px-3 py-2 text-sm font-semibold">{row.net_salary}</td>
                  <td className="px-3 py-2 text-sm">
                    <StatusBadge status={row.approval_status} />
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <StatusBadge status={row.payment_status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {isPending && (
                        <button
                          type="button"
                          onClick={() => approve(row.payroll_id)}
                          disabled={busy}
                          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Setujui
                        </button>
                      )}
                      {isApproved && isUnpaid && (
                        <button
                          type="button"
                          onClick={() => toggleMarkPaid(row.payroll_id)}
                          disabled={busy}
                          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Tandai Dibayar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-blue-50">
                    <td colSpan={6} className="px-3 py-3">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-blue-800">Payment reference (mis: TRF-2026-07-001)</label>
                        <input
                          value={paymentRef}
                          onChange={(e) => setPaymentRef(e.target.value)}
                          className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm"
                          placeholder="TRF-2026-07-001"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => markPaid(row.payroll_id)}
                            disabled={busy}
                            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {busy ? "..." : "Konfirmasi"}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleMarkPaid(row.payroll_id)}
                            disabled={busy}
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
