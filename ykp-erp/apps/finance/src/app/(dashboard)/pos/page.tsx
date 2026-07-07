/**
 * POS Revenue page — CRUD tabel + Moka CSV import + inline new transaction form.
 */
"use client";

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, ExportButton, KpiCard, formatIdr } from "@ykp/ui";
import { usePosList } from "@/features/finance/api/queries";
import { useExportCsv, useExportPdf, useImportPos } from "@/features/finance/api/mutations";
import { PosTable } from "@/features/finance/components/pos-table";
import { PosFormDialog } from "@/features/finance/components/pos-form-dialog";
import { Upload } from "lucide-react";
import type { PosDaily } from "@/features/finance/api/types";

export default function PosPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const params = React.useMemo(() => new URLSearchParams({ date_from: monthStartStr, date_to: today }), [monthStartStr, today]);
  const { data = [] } = usePosList(params);
  const rows = data as PosDaily[];

  const exportPdf = useExportPdf();
  const exportCsv = useExportCsv();
  const importPos = useImportPos();

  const totalRevenue = rows.reduce((acc, r) => acc + (r.netSales ?? 0), 0);
  const paidInvoices = rows.filter((r) => r.aov > 0).length;
  const aov = rows.length ? Math.round(totalRevenue / Math.max(rows.reduce((acc, r) => acc + r.transactionCount, 0), 1)) : 0;

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    importPos.mutate(fd);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">POS Revenue</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <label className="flex cursor-pointer items-center gap-2">
              <Upload className="h-4 w-4" />
              Import CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onUpload} />
            </label>
          </Button>
          <ExportButton
            label="Export"
            onExportPdf={() => exportPdf.mutateAsync({ report: "pos_daily", date_from: monthStartStr, date_to: today, filters: {} })}
            onExportCsv={() => exportCsv.mutateAsync({ report: "pos_daily", date_from: monthStartStr, date_to: today, filters: {} })}
          />
          <PosFormDialog />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Total Revenue" value={formatIdr(totalRevenue)} />
        <KpiCard title="Paid Invoices" value={paidInvoices} />
        <KpiCard title="AOV" value={formatIdr(aov)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Transaksi POS</CardTitle>
        </CardHeader>
        <CardContent>
          <PosTable params={params} />
        </CardContent>
      </Card>
    </div>
  );
}
