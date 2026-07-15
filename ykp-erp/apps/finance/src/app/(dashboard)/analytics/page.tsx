/**
 * Analytics page — revenue trend, profit trend, payment breakdown,
 * supplier aging, and supplier cost KPI. Period + brand/outlet filters
 * drive all queries via URLSearchParams.
 */
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  KpiCard,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  formatIdr,
} from "@ykp/ui";
import {
  useProfitAnalytics,
  useRevenueAnalytics,
  useUnpaidList,
  useBrands,
  useOutlets,
} from "@finance/features/finance/api/queries";
import { todayWib } from "@ykp/engine/client";

type Period = "week" | "month" | "quarter";

const PERIOD_LABELS: Record<Period, string> = {
  week: "7 Hari",
  month: "Bulan Ini",
  quarter: "Kuartal",
};

/** Compute YYYY-MM-DD that is `days` before today (WIB). */
function daysAgo(days: number): string {
  const d = new Date(todayWib());
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const today = todayWib();
  const [period, setPeriod] = React.useState<Period>("month");
  const [brandId, setBrandId] = React.useState<string>("ALL");
  const [outletId, setOutletId] = React.useState<string>("ALL");

  // Master data for filter dropdowns
  const { data: brands = [] } = useBrands();
  const { data: outlets = [] } = useOutlets();

  // Build query params — period drives the window; brand/outlet filter when set.
  const params = React.useMemo(() => {
    const p = new URLSearchParams({ period });
    if (brandId !== "ALL") p.set("brand_id", brandId);
    if (outletId !== "ALL") p.set("outlet_id", outletId);
    return p;
  }, [period, brandId, outletId]);

  const revenue = useRevenueAnalytics(params);
  const profit = useProfitAnalytics(params);
  const unpaid = useUnpaidList();

  const r = revenue.data;
  const p = profit.data;

  // ---- Aging buckets from unpaid list ----
  const aging = React.useMemo(() => {
    const buckets = [
      { label: "0–30 hari", min: 0, max: 30, count: 0, amount: 0 },
      { label: "31–60 hari", min: 31, max: 60, count: 0, amount: 0 },
      { label: "61–90 hari", min: 61, max: 90, count: 0, amount: 0 },
      { label: "90+ hari", min: 91, max: Infinity, count: 0, amount: 0 },
    ];
    for (const row of unpaid.data ?? []) {
      const d = row.aging_days ?? 0;
      for (const b of buckets) {
        if (d >= b.min && d <= b.max) {
          b.count++;
          b.amount += (row as { amount?: number }).amount ?? 0;
          break;
        }
      }
    }
    return buckets;
  }, [unpaid.data]);

  const periodLabel = PERIOD_LABELS[period];

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Trend revenue & profit untuk periode {periodLabel.toLowerCase()}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex rounded-md border border-input">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Brand filter */}
          <Select value={brandId} onValueChange={(v) => { setBrandId(v); setOutletId("ALL"); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Semua Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Brand</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.brandId} value={b.brandId}>
                  {b.brandName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Outlet filter */}
          <Select value={outletId} onValueChange={setOutletId}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Semua Outlet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Outlet</SelectItem>
              {outlets
                .filter((o) => brandId === "ALL" || o.brandId === brandId)
                .map((o) => (
                  <SelectItem key={o.outletId} value={o.outletId}>
                    {o.outletName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title={`Total Revenue (${periodLabel})`} value={formatIdr(r?.total ?? 0)} />
        <KpiCard title={`Est. Operating Result (${periodLabel})`} value={formatIdr(p?.net ?? 0)} />
        <KpiCard title={`Expense (${periodLabel})`} value={formatIdr(p?.expense ?? 0)} />
        <KpiCard title={`Supplier Cost (${periodLabel})`} value={formatIdr(p?.supplier_cost ?? 0)} />
      </div>

      {/* Revenue Trend + Profit Trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenue Trend</CardTitle></CardHeader>
          <CardContent>
            {r?.by_day?.length ? (
              <ul className="space-y-1 text-sm">
                {r.by_day.map((d) => (
                  <li key={d.date} className="flex justify-between">
                    <span className="text-muted-foreground">{d.date}</span>
                    <span className="tabular-nums">{formatIdr(d.revenue)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground">Belum ada data revenue.</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Profit Trend</CardTitle></CardHeader>
          <CardContent>
            {p ? (
              <ul className="space-y-1 text-sm">
                <li className="flex justify-between"><span className="text-muted-foreground">Revenue</span><span className="tabular-nums">{formatIdr(p.revenue)}</span></li>
                <li className="flex justify-between"><span className="text-muted-foreground">Expense</span><span className="tabular-nums">{formatIdr(p.expense)}</span></li>
                <li className="flex justify-between"><span className="text-muted-foreground">Supplier</span><span className="tabular-nums">{formatIdr(p.supplier_cost)}</span></li>
                <li className="flex justify-between"><span className="text-muted-foreground">Petty Out</span><span className="tabular-nums">{formatIdr(p.petty_cash_out)}</span></li>
                <li className="flex justify-between border-t pt-2"><span className="font-medium">Net</span><span className="tabular-nums font-medium">{formatIdr(p.net)}</span></li>
              </ul>
            ) : (
              <div className="text-muted-foreground">Belum ada data profit.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Breakdown + Outstanding Supplier Aging */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Payment Method Breakdown */}
        <Card>
          <CardHeader><CardTitle>Payment Method Breakdown</CardTitle></CardHeader>
          <CardContent>
            {r?.by_payment?.length ? (
              <ul className="space-y-1 text-sm">
                {r.by_payment.map((pm) => (
                  <li key={pm.method} className="flex justify-between">
                    <span className="text-muted-foreground">{pm.method}</span>
                    <span className="tabular-nums">{formatIdr(pm.revenue)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground">Belum ada data payment method.</div>
            )}
          </CardContent>
        </Card>

        {/* Outstanding Supplier Aging */}
        <Card>
          <CardHeader><CardTitle>Outstanding Supplier Aging</CardTitle></CardHeader>
          <CardContent>
            {aging.some((b) => b.count > 0) ? (
              <ul className="space-y-2 text-sm">
                {aging.map((b) => (
                  <li key={b.label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span className="tabular-nums">
                      {b.count} tagihan &middot; {formatIdr(b.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground">Tidak ada tagihan outstanding.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
