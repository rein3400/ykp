/**
 * Expense log page — CRUD + approval. KPI by category & outlet.
 */
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, ExportButton, KpiCard, formatIdr } from "@ykp/ui";
import { ExpenseTable } from "@finance/features/finance/components/expense-table";
import { ExpenseFormDialog } from "@finance/features/finance/components/expense-form-dialog";
import { useExpenseList } from "@finance/features/finance/api/queries";
import { useApproveExpense, useExportCsv, useExportPdf } from "@finance/features/finance/api/mutations";
import { todayWib } from "@ykp/engine/client";
import type { Expense } from "@finance/features/finance/api/types";

export default function ExpensesPage() {
  // WIB calendar date — DB rows are dated by WIB.
  const today = todayWib();
  const from = `${today.slice(0, 7)}-01`;

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
          <ExpenseFormDialog />
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