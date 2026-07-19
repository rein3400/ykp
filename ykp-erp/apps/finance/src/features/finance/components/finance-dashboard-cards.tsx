/**
 * Ringkasan Finance KPI cards.
 *
 * Rewritten from the backup demo to query real /api/fin/summary for today.
 * If no summary rows exist today, the cards render 0 with a hint.
 */
"use client";

import * as React from "react";
import { KpiCard, formatIdr } from "@ykp/ui";
import { todayWib } from "@ykp/engine/client";
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
  // WIB calendar date — DB rows are dated by WIB. nowWib().toISOString()
  // returns UTC, which excludes the most recent WIB-day rows.
  const today = todayWib();
  // Query the last 14 WIB days (ordered desc by the API). If today's summary
  // has not been rebuilt yet, fall back to the most recent day that has data
  // so the dashboard cards show the latest snapshot instead of all-zero.
  // Compute `from` in WIB too — new Date().toISOString() is the UTC calendar
  // day, which is one day behind WIB between 00:00–06:59 WIB and shifts the
  // whole window by a day during those hours.
  const fromDate = new Date(`${today}T00:00:00+07:00`);
  fromDate.setDate(fromDate.getDate() - 13);
  const fromStr = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-${String(fromDate.getDate()).padStart(2, "0")}`;
  const params = new URLSearchParams({ date_from: fromStr, date_to: today, limit: "400" });
  const { data: rows = [], isLoading } = useSummaryList(params);

  const consolidated = React.useMemo(() => {
    const base: DailySummary[] = rows.length ? (rows as DailySummary[]) : [];
    // Pick the latest date present in the data; fall back to today if none.
    let latestDate = today;
    if (base.length) {
      const dates = base.map((r) => (r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10)));
      latestDate = dates.sort().reverse()[0];
    }
    const sameDay = base.filter((r) => {
      const d = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
      return d === latestDate;
    });
    const sum = sameDay.reduce(
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
    return { ...sum, latestDate };
  }, [rows, today]);

  const net = consolidated.netProfitEstimate;
  const positive = net >= 0;
  const isStale = consolidated.latestDate !== today;

  if (isLoading) return <div className="text-muted-foreground">Memuat ringkasan...</div>;

  return (
    <div className="space-y-2">
      {/* Data-date caption: the cards fall back to the latest day WITH data,
          so always disclose which day the numbers represent (trust). */}
      <p className={`text-xs ${isStale ? "text-amber-600" : "text-muted-foreground"}`}>
        {isStale
          ? `Belum ada data hari ini — menampilkan data per ${consolidated.latestDate}`
          : `Data per ${consolidated.latestDate}`}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <KpiCard title="Consolidated Revenue" value={formatIdr(consolidated.revenue)} icon={<TrendingUp className="h-5 w-5" />} />
        <KpiCard title="Consolidated Expenses" value={formatIdr(consolidated.expense)} icon={<TrendingDown className="h-5 w-5" />} />
        <KpiCard
          title="Est. Operating Result"
          value={formatIdr(net)}
          icon={<Wallet className="h-5 w-5" />}
          delta={positive ? 1 : -1}
          deltaSuffix=""
          hideArrow
        />
        <KpiCard title="Est. Cash Surplus" value={formatIdr(consolidated.revenue - consolidated.expense)} icon={<PiggyBank className="h-5 w-5" />} />
        <KpiCard title="Accounts Payable" value={formatIdr(consolidated.unpaidSupplier)} icon={<CreditCard className="h-5 w-5" />} />
        <KpiCard title="Cash Inflow" value={formatIdr(consolidated.revenue)} icon={<Banknote className="h-5 w-5" />} />
        <KpiCard title="Cash Outflow" value={formatIdr(consolidated.expense + consolidated.supplierCost + consolidated.pettyCashOut)} icon={<ArrowRightLeft className="h-5 w-5" />} />
        <KpiCard title="Supplier Top Spend" value={formatIdr(consolidated.supplierCost)} icon={<Users className="h-5 w-5" />} />
        <KpiCard title="Unit Margin Matrix" value={formatIdr(net)} icon={<Package className="h-5 w-5" />} />
      </div>
    </div>
  );
}