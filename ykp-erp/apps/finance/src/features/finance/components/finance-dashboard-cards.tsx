/**
 * Ringkasan Finance KPI cards.
 *
 * Rewritten from the backup demo to query real /api/fin/summary for today.
 * If no summary rows exist today, the cards render 0 with a hint.
 */
"use client";

import * as React from "react";
import { KpiCard, formatIdr, nowWib } from "@ykp/ui";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Users,
  Package,
} from "lucide-react";
import { useSummaryList } from '../api/queries';
import type { DailySummary } from '../api/types';

export function FinanceDashboardCards() {
  const today = nowWib().toISOString().slice(0, 10);
  const params = new URLSearchParams({ date_from: today, date_to: today });
  const { data: rows = [], isLoading } = useSummaryList(params);

  const consolidated = React.useMemo(() => {
    const base: DailySummary[] = rows.length ? (rows as DailySummary[]) : [];
    return base.reduce(
      (acc, r) => ({
        revenue: acc.revenue + (r.revenue ?? 0),
        expense: acc.expense + (r.expense ?? 0),
        supplierCost: acc.supplierCost + (r.supplierCost ?? 0),
        pettyCashOut: acc.pettyCashOut + (r.pettyCashOut ?? 0),
        unpaidSupplier: acc.unpaidSupplier + (r.unpaidSupplier ?? 0),
        cashDifference: acc.cashDifference + (r.cashDifference ?? 0),
        netProfitEstimate: acc.netProfitEstimate + (r.netProfitEstimate ?? 0),
      }),
      { revenue: 0, expense: 0, supplierCost: 0, pettyCashOut: 0, unpaidSupplier: 0, cashDifference: 0, netProfitEstimate: 0 },
    );
  }, [rows]);

  const net = consolidated.netProfitEstimate;
  const positive = net >= 0;

  if (isLoading) return <div className="text-muted-foreground">Memuat ringkasan...</div>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      <KpiCard title="Consolidated Revenue" value={formatIdr(consolidated.revenue)} icon={<TrendingUp className="h-5 w-5" />} />
      <KpiCard title="Consolidated Expenses" value={formatIdr(consolidated.expense)} icon={<TrendingDown className="h-5 w-5" />} />
      <KpiCard
        title="Consolidated Net Profit"
        value={formatIdr(net)}
        icon={<Wallet className="h-5 w-5" />}
        delta={positive ? 1 : -1}
        deltaSuffix=""
        hideArrow
      />
      <KpiCard title="Group Cash Position" value={formatIdr(consolidated.revenue - consolidated.expense)} icon={<PiggyBank className="h-5 w-5" />} />
      <KpiCard title="Accounts Payable" value={formatIdr(consolidated.unpaidSupplier)} icon={<CreditCard className="h-5 w-5" />} />
      <KpiCard title="Cash Inflow" value={formatIdr(consolidated.revenue)} icon={<Banknote className="h-5 w-5" />} />
      <KpiCard title="Cash Outflow" value={formatIdr(consolidated.expense + consolidated.supplierCost + consolidated.pettyCashOut)} icon={<ArrowRightLeft className="h-5 w-5" />} />
      <KpiCard title="Supplier Top Spend" value={formatIdr(consolidated.supplierCost)} icon={<Users className="h-5 w-5" />} />
      <KpiCard title="Unit Margin Matrix" value={formatIdr(net)} icon={<Package className="h-5 w-5" />} />
    </div>
  );
}