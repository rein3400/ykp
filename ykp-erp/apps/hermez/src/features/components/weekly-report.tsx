"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ykp/ui";

interface WeeklyRow {
  brand: string;
  outlet: string;
  date: string;
  revenue: number;
  expense: number;
  netProfit: number;
  staffLate: number;
  staffAbsent: number;
  cashDifference: number;
}

function formatRupiah(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n));
  return `${sign}Rp ${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

export function WeeklyReport({ rows }: { rows: WeeklyRow[] }) {
  const totals = React.useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        revenue: acc.revenue + r.revenue,
        expense: acc.expense + r.expense,
        netProfit: acc.netProfit + r.netProfit,
        late: acc.late + r.staffLate,
        absent: acc.absent + r.staffAbsent,
      }),
      { revenue: 0, expense: 0, netProfit: 0, late: 0, absent: 0 },
    );
  }, [rows]);

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Report</CardTitle>
          <CardDescription>Tidak ada data 7 hari terakhir.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Weekly Report</CardTitle>
          <CardDescription>Aggregasi 7 hari terakhir</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total revenue</p>
              <p className="text-lg font-semibold">{formatRupiah(totals.revenue)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total net profit</p>
              <p className={totals.netProfit < 0 ? "text-lg font-semibold text-destructive" : "text-lg font-semibold"}>
                {formatRupiah(totals.netProfit)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total late staff</p>
              <p className="text-lg font-semibold">{totals.late}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total absent staff</p>
              <p className="text-lg font-semibold">{totals.absent}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per outlet</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Outlet</th>
                  <th className="px-3 py-2">Brand</th>
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Revenue</th>
                  <th className="px-3 py-2">Net profit</th>
                  <th className="px-3 py-2">Cash diff</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.outlet}-${r.date}`} className="border-b">
                    <td className="px-3 py-2 font-medium">{r.outlet}</td>
                    <td className="px-3 py-2">{r.brand}</td>
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2">{formatRupiah(r.revenue)}</td>
                    <td className={r.netProfit < 0 ? "px-3 py-2 text-destructive" : "px-3 py-2"}>
                      {formatRupiah(r.netProfit)}
                    </td>
                    <td className={r.cashDifference !== 0 ? "px-3 py-2 text-destructive" : "px-3 py-2"}>
                      {formatRupiah(r.cashDifference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}