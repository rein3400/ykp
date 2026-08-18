/**
 * Analytics page — revenue trend + profit trend.
 */
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, KpiCard, formatIdr } from "../../../../_packages/ui/src";
import { useProfitAnalytics, useRevenueAnalytics } from "../../../features/finance/api/queries";

export default function AnalyticsPage() {
  const params = React.useMemo(() => new URLSearchParams({ period: "month" }), []);
  const revenue = useRevenueAnalytics(params);
  const profit = useProfitAnalytics(params);

  const r = revenue.data;
  const p = profit.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Analytics</h2>
        <p className="text-sm text-muted-foreground">Trend revenue & profit untuk periode bulan ini.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Total Revenue (month)" value={formatIdr(r?.total ?? 0)} />
        <KpiCard title="Net Profit (month)" value={formatIdr(p?.net ?? 0)} />
        <KpiCard title="Expense (month)" value={formatIdr(p?.expense ?? 0)} />
      </div>

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
    </div>
  );
}