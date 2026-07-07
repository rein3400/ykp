/**
 * Expense log table with category/outlet filters, approval badges, and
 * inline approve/reject actions.
 */
"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, Button, formatIdr, formatDateWib } from "@ykp/ui";
import { useExpenseList } from "../api/queries.js";
import { ApprovalStatusBadge, CurrencyCell } from "./finance-shared.js";
import type { Expense } from "../api/types.js";

export interface ExpenseTableProps {
  params: URLSearchParams;
  onApprove?: (row: Expense) => void;
  onEdit?: (row: Expense) => void;
}

export function ExpenseTable({ params, onApprove, onEdit }: ExpenseTableProps) {
  const { data = [], isLoading } = useExpenseList(params);
  const rows = data as Expense[];

  const columns = React.useMemo<ColumnDef<Expense>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Tanggal",
        cell: ({ getValue }) => formatDateWib(getValue() as string),
      },
      { accessorKey: "outletName", header: "Outlet" },
      { accessorKey: "categoryId", header: "Kategori" },
      { accessorKey: "description", header: "Deskripsi" },
      {
        accessorKey: "amount",
        header: "Jumlah",
        cell: ({ getValue }) => <CurrencyCell value={getValue() as number} />,
      },
      { accessorKey: "paymentMethodId", header: "Metode" },
      {
        accessorKey: "approvalStatus",
        header: "Status",
        cell: ({ getValue }) => <ApprovalStatusBadge status={getValue() as never} />,
      },
      {
        id: "actions",
        header: "Aksi",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {onEdit && <Button variant="ghost" size="sm" onClick={() => onEdit(row.original)}>Edit</Button>}
            {onApprove && row.original.approvalStatus === "PENDING" && (
              <Button variant="outline" size="sm" onClick={() => onApprove(row.original)}>Approve</Button>
            )}
          </div>
        ),
      },
    ],
    [onApprove, onEdit],
  );

  if (isLoading) return <div className="text-muted-foreground">Memuat expense...</div>;
  return <DataTable columns={columns} data={rows} searchPlaceholder="Cari expense..." emptyMessage="Belum ada expense." />;
}
