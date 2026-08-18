/**
 * Petty Cash ledger + running balance + urgent approval.
 */
"use client";

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, ExportButton, KpiCard, formatIdr } from "../../../../_packages/ui/src";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../../_packages/ui/src";
import { usePettyCashBalance, usePettyCashList } from "../../../features/finance/api/queries";
import { useApprovePettyCash, useExportCsv, useExportPdf } from "../../../features/finance/api/mutations";
import { PettyCashTable } from "../../../features/finance/components/petty-cash-table";

// Inline Asia/Jakarta date — equivalent to todayWib() in @ykp/engine/audit,
// but avoids pulling the audit module which transitively imports postgres
// (Node-only), causing webpack to fail on `dns` / `tls` / `fs` for the
// client bundle.
function todayWib(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export default function PettyCashPage() {
  const today = todayWib();
  const params = React.useMemo(() => new URLSearchParams(), []);
  const { data = [] } = usePettyCashList(params);
  const balance = usePettyCashBalance(data[0]?.outletId, today);
  const approve = useApprovePettyCash();
  const exportPdf = useExportPdf();
  const exportCsv = useExportCsv();

  const inTotal = (data as []).filter((r: { type: string }) => r.type === "in").reduce((acc: number, r: { amount: number }) => acc + (r.amount ?? 0), 0);
  const outTotal = (data as []).filter((r: { type: string }) => r.type === "out").reduce((acc: number, r: { amount: number }) => acc + (r.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Petty Cash</h2>
        <ExportButton
          onExportPdf={async () => { await exportPdf.mutateAsync({ report: "petty_cash", date_from: today, date_to: today, filters: {} }); }}
          onExportCsv={async () => { await exportCsv.mutateAsync({ report: "petty_cash", date_from: today, date_to: today, filters: {} }); }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <KpiCard title="Opening" value={formatIdr(balance.data?.opening_balance ?? 0)} />
        <KpiCard title="Top-up" value={formatIdr(inTotal)} />
        <KpiCard title="Out" value={formatIdr(outTotal)} />
        <KpiCard title="Running Balance" value={formatIdr(balance.data?.running_balance ?? 0)} />
        <KpiCard title="COH Status" value={balance.data ? "Rekons" : "-"} />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="in">Debit</TabsTrigger>
          <TabsTrigger value="out">Kredit</TabsTrigger>
          <TabsTrigger value="urgent">Urgent</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <Card>
            <CardHeader><CardTitle>Ledger Petty Cash</CardTitle></CardHeader>
            <CardContent>
              <PettyCashTable params={params} onApprove={(r) => approve.mutate({ id: r.pcId, body: { decision: "APPROVE" } })} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="in">
          <Card>
            <CardHeader><CardTitle>Masuk</CardTitle></CardHeader>
            <CardContent>
              <PettyCashTable params={new URLSearchParams({ type: "in" })} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="out">
          <Card>
            <CardHeader><CardTitle>Keluar</CardTitle></CardHeader>
            <CardContent>
              <PettyCashTable params={new URLSearchParams({ type: "out" })} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="urgent">
          <Card>
            <CardHeader><CardTitle>Urgent Approval</CardTitle></CardHeader>
            <CardContent>
              <PettyCashTable params={new URLSearchParams({ urgent_only: "true" })} onApprove={(r) => approve.mutate({ id: r.pcId, body: { decision: "APPROVE" } })} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
