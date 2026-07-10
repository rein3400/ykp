"use client";
/**
 * Reusable status badge — used by leaves, adjustments, payroll, attendance, roster, lateness.
 */
import * as React from "react";

type Status =
  | "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED"
  | "OPEN" | "ACK" | "RESOLVED"
  | "PRESENT" | "LATE" | "ABSENT" | "LEAVE" | "SICK" | "OFF" | "INCOMPLETE" | "MANUAL_CORRECTION"
  | "SCHEDULED" | "ACTIVE" | "INACTIVE" | "FILLED" | "OPEN_SHIFT";

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
  PRESENT: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  LATE: "bg-amber-100 text-amber-800 border border-amber-200",
  ABSENT: "bg-rose-100 text-rose-800 border border-rose-200",
  LEAVE: "bg-blue-100 text-blue-800 border border-blue-200",
  SICK: "bg-purple-100 text-purple-800 border border-purple-200",
  OFF: "bg-slate-100 text-slate-700 border border-slate-200",
  INCOMPLETE: "bg-amber-100 text-amber-800 border border-amber-200",
  MANUAL_CORRECTION: "bg-blue-100 text-blue-800 border border-blue-200",
  SCHEDULED: "bg-slate-100 text-slate-700 border border-slate-200",
  ACTIVE: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  INACTIVE: "bg-slate-100 text-slate-500 border border-slate-200",
  FILLED: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  OPEN_SHIFT: "bg-rose-100 text-rose-800 border border-rose-200"
};

export function StatusBadge({ status, children }: { status: string; children?: React.ReactNode }) {
  const cls = STYLES[status as Status] ?? "bg-slate-100 text-slate-700 border border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children ?? (status || '-')}
    </span>
  );
}