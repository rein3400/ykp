"use client";
/**
 * Reusable status badge — used by leaves, adjustments, payroll.
 */
import * as React from "react";

type Status = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED" | "OPEN" | "ACK" | "RESOLVED";

const STYLES: Record<Status, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border border-slate-200",
  PENDING: "bg-amber-100 text-amber-800 border border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 border border-rose-200",
  PAID: "bg-blue-100 text-blue-800 border border-blue-200",
  CANCELLED: "bg-slate-100 text-slate-500 border border-slate-200 line-through",
  OPEN: "bg-rose-100 text-rose-800 border border-rose-200",
  ACK: "bg-amber-100 text-amber-800 border border-amber-200",
  RESOLVED: "bg-emerald-100 text-emerald-800 border border-emerald-200",
};

export function StatusBadge({ status, children }: { status: string; children?: React.ReactNode }) {
  const cls = STYLES[status as Status] ?? "bg-slate-100 text-slate-700 border border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children ?? status}
    </span>
  );
}
