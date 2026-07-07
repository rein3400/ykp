/**
 * Supplier costing page — CRUD + payment approval + unpaid view.
 */
"use client";

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, ExportButton, KpiCard, formatIdr } from "@ykp/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@ykp/ui";
import { SupplierCostTable } from "@/features/finance/components/supplier-cost-table";
import { SupplierCostFormDialog } from "@/features/finance/components/supplier-cost-form-dialog";
import { useSupplierList, useUnpaidList } from "@/features/finance/api/queries";
import { useApproveSupplierPayment, useExportCsv, useExportPdf } from "@/features/finance/api/mutations";
import { Plus, Bell } from "lucide-react";
import type { SupplierCost } from "@/features/finance/api/types";

export default function SuppliersPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);
  const from = monthStart.toISOString().slice(0, 10);

  const params = React.useMemo(() => new URLSearchParams({ date_from: from, date_to: today }), [from, today]);
  const list = useSupplierList(params);
  const unpaid = useUnpaidList();
  const approve = useApproveSupplierPayment();
  const exportPdf = useExportPdf();
  const exportCsv = useExportCsv();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SupplierCost | null>(null);

  const total = (list.data ?? []).reduce((acc, r) => acc + (r.amount ?? 0), 0);
  const paid = (list.data ?? []).reduce((acc, r) => acc + (r.paidAmount ?? 0), 0);
  const unpaidAmt = (list.data ?? []).reduce((acc, r) => acc + (r.unpaidAmount ?? 0), 0);
  const overdue = (unpaid.data ?? []).filter((r) => r.aging_days > 30).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Costing Supplier</h2>
        <div className="flex items-center gap-2">
          <ExportButton
            onExportPdf={() => exportPdf.mutateAsync({ report: "supplier_cost", date_from: from, date_to: today, filters: {} })}
            onExportCsv={() => exportCsv.mutateAsync({ report: "supplier_cost", date_from: from, date_to: today, filters: {} })}
          />
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Tambah Cost
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total MTD" value={formatIdr(total)} />
        <KpiCard title="Paid" value={formatIdr(paid)} />
        <KpiCard title="Unpaid" value={formatIdr(unpaidAmt)} />
        <KpiCard title="Overdue >30d" value={overdue} />
      </div>

      {overdue > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          <Bell className="h-4 w-4 mt-0.5" />
          <span>{overdue} supplier cost(s) lewat jatuh tempo &gt; 30 hari. Jadwalkan pembayaran.</span>
        </div>
      ) : null}

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Daftar Supplier Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <SupplierCostTable
                params={params}
                onEdit={(r) => { setEditing(r); setOpen(true); }}
                onPay={(r) =>
                  approve.mutate({ id: r.costId, body: { decision: "APPROVE", paid_amount: r.amount, reason: "Marked paid from supplier page" } })
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="unpaid">
          <Card>
            <CardHeader>
              <CardTitle>Tagihan Belum Dibayar</CardTitle>
            </CardHeader>
            <CardContent>
              <SupplierCostTable params={params} showOnlyUnpaid onPay={(r) => approve.mutate({ id: r.costId, body: { decision: "APPROVE" } })} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SupplierCostFormDialog open={open} onOpenChange={setOpen} row={editing} />
    </div>
  );
}
