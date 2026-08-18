/**
 * Daily summary grid + rebuild button.
 */
"use client";

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, formatIdr, formatDateWib } from "../../../../_packages/ui/src";
import { useSummaryList } from "../../../features/finance/api/queries";
import { useRebuildSummary } from "../../../features/finance/api/mutations";
import { RefreshCw } from "lucide-react";

export default function SummaryPage() {
  const today = new Date().toISOString().slice(0, 10);
  const params = React.useMemo(() => new URLSearchParams({ date_from: today, date_to: today, limit: "60" }), [today]);
  const { data = [], isLoading } = useSummaryList(params);
  const rebuild = useRebuildSummary();

  const rows = data as { date: string | Date; brand: string; outlet: string; revenue: number; expense: number; supplierCost: number; pettyCashOut: number; unpaidSupplier: number; cashDifference: number; netProfitEstimate: number; majorFinanceIssue: string; recommendedAction?: string | null }[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Daily Summary</h2>
        <Button onClick={() => rebuild.mutate({ date: today })} disabled={rebuild.isPending}>
          <RefreshCw className="mr-2 h-4 w-4" /> {rebuild.isPending ? "Rebuild..." : "Rebuild Today"}
        </Button>
      </div>

      {rebuild.data ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Rebuild selesai: {rebuild.data.rebuilt.filter((r) => r.ok).length} outlet sukses, {rebuild.data.rebuilt.filter((r) => !r.ok).length} gagal.
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle>fin_daily_summary</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground">Memuat...</div>
          ) : rows.length === 0 ? (
            <div className="text-muted-foreground">Belum ada ringkasan untuk hari ini. Klik Rebuild.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2">Tanggal</th>
                    <th className="px-2 py-2">Brand</th>
                    <th className="px-2 py-2">Outlet</th>
                    <th className="px-2 py-2">Revenue</th>
                    <th className="px-2 py-2">Expense</th>
                    <th className="px-2 py-2">Supplier</th>
                    <th className="px-2 py-2">Petty Out</th>
                    <th className="px-2 py-2">Unpaid</th>
                    <th className="px-2 py-2">Net</th>
                    <th className="px-2 py-2">Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-2 py-2">{typeof r.date === "string" ? r.date : formatDateWib(r.date)}</td>
                      <td className="px-2 py-2">{r.brand}</td>
                      <td className="px-2 py-2">{r.outlet}</td>
                      <td className="px-2 py-2 tabular-nums">{formatIdr(r.revenue)}</td>
                      <td className="px-2 py-2 tabular-nums">{formatIdr(r.expense)}</td>
                      <td className="px-2 py-2 tabular-nums">{formatIdr(r.supplierCost)}</td>
                      <td className="px-2 py-2 tabular-nums">{formatIdr(r.pettyCashOut)}</td>
                      <td className="px-2 py-2 tabular-nums">{formatIdr(r.unpaidSupplier)}</td>
                      <td className="px-2 py-2 tabular-nums">{formatIdr(r.netProfitEstimate)}</td>
                      <td className="px-2 py-2">{r.majorFinanceIssue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}