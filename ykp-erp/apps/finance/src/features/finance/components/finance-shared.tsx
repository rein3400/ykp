/**
 * Shared finance UI primitives: status badges, filter helpers, and
 * formatters used across multiple finance pages.
 */
"use client";

import * as React from "react";
import { Badge } from "@ykp/ui";
import { formatIdr } from "@ykp/ui";
import type { PaymentStatus, ApprovalStatus } from '../api/types';

const paymentVariant: Record<PaymentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  UNPAID: "destructive",
  PARTIAL: "secondary",
  PAID: "default",
  OVERDUE: "destructive",
  CANCELLED: "outline",
};

const approvalVariant: Record<ApprovalStatus, "default" | "secondary" | "destructive" | "outline" | "warning"> = {
  DRAFT: "outline",
  PENDING: "warning",
  APPROVED: "default",
  REJECTED: "destructive",
  PAID: "secondary",
  CANCELLED: "outline",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={paymentVariant[status]}>{status}</Badge>;
}

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  return <Badge variant={approvalVariant[status]}>{status}</Badge>;
}

export function CurrencyCell({ value }: { value: number | null | undefined }) {
  return <span className="tabular-nums">{formatIdr(value ?? 0)}</span>;
}

export function createSearchParams(filters: Record<string, string | undefined | null>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) p.set(k, v);
  }
  return p;
}