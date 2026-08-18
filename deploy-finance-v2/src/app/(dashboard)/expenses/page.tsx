/**
 * Expense log page — CRUD + approval. KPI by category & outlet.
 */
"use client";

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, ExportButton, KpiCard, formatIdr } from "../../../../_packages/ui/src";
import { ExpenseTable } from "../../../features/finance/components/expense-table";
import { useExpenseList } from "../../../features/finance/api/queries";
import { useApproveExpense, useExportCsv, useExportPdf } from "../../../features/finance/api/mutations";
import { Plus } from "lucide-react";
import type { Expense } from "../../../features/finance/api/types";

export default function ExpensesPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);
  const from = monthStart.toISOString().slice(0, 10);

  const params = React.useMemo(() => new URLSearchParams({ date_from: from, date_to: today }), [from, today]);
  const { data = [] } = useExpenseList(params);
  const rows = data as Expense[];

  const total = rows.reduce((acc, r) => acc + (r.amount ?? 0), 0);
  const approve = useApproveExpense();
  const exportPdf = useExportPdf();
  const exportCsv = useExportCsv();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Expense Log</h2>
        <div className="flex items-center gap-2">
          <ExportButton
            onExportPdf={async () => { await exportPdf.mutateAsync({ report: "expense", date_from: from, date_to: today, filters: {} }); }}
            onExportCsv={async () => { await exportCsv.mutateAsync({ report: "expense", date_from: from, date_to: today, filters: {} }); }}
          />
          <Button><Plus className="mr-2 h-4 w-4" /> Tambah Expense</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <KpiCard title="Total MTD" value={formatIdr(total)} />
        <KpiCard title="Jumlah Transaksi" value={rows.length} />
      </div>

      <Card>
        <CardHeader><CardTitle>Daftar Expense</CardTitle></CardHeader>
        <CardContent>
          <ExpenseTable params={params} onApprove={(r) => approve.mutate({ id: r.expenseId, body: { decision: "APPROVE" } })} />
        </CardContent>
      </Card>
    </div>
  );
}