/**
 * Supplier costing table with payment status badges, aging, and action buttons.
 */
"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, Button, formatIdr, formatDateWib } from "@ykp/ui";
import { CheckCircle, XCircle, Upload } from "lucide-react";
import { useSupplierList, useUnpaidList } from '../api/queries';
import { PaymentStatusBadge, CurrencyCell } from './finance-shared';
import type { SupplierCost } from '../api/types';

export interface SupplierCostTableProps {
  params: URLSearchParams;
  showOnlyUnpaid?: boolean;
  onEdit?: (row: SupplierCost) => void;
  onPay?: (row: SupplierCost) => void;
  onDelete?: (row: SupplierCost) => void;
}

export function SupplierCostTable({ params, showOnlyUnpaid, onEdit, onPay, onDelete }: SupplierCostTableProps) {
  const list = useSupplierList(params);
  const unpaid = useUnpaidList();
  const data = (showOnlyUnpaid ? (unpaid.data ?? []) : (list.data ?? [])) as SupplierCost[];
  const rows = showOnlyUnpaid ? (data as (SupplierCost & { aging_days: number })[]) : data;

  const columns = React.useMemo<ColumnDef<SupplierCost>[]>(() => [
    {
      accessorKey: "date",
      header: "Tanggal",
      cell: ({ getValue }) => formatDateWib(getValue() as string),
    },
    { accessorKey: "outletName", header: "Outlet" },
    { accessorKey: "supplierName", header: "Supplier" },
    { accessorKey: "description", header: "Keterangan" },
    { accessorKey: "category", header: "Kategori" },
    { accessorKey: "amount", header: "Total", cell: ({ getValue }) => <CurrencyCell value={getValue() as number} /> },
    { accessorKey: "paidAmount", header: "Dibayar", cell: ({ getValue }) => <CurrencyCell value={getValue() as number} /> },
    { accessorKey: "unpaidAmount", header: "Sisa", cell: ({ getValue }) => <CurrencyCell value={getValue() as number} /> },
    {
      accessorKey: "paymentStatus",
      header: "Status",
      cell: ({ getValue }) => <PaymentStatusBadge status={getValue() as never} />,
    },
    {
      accessorKey: "dueDate",
      header: "Jatuh Tempo",
      cell: ({ getValue }) => (getValue() ? formatDateWib(getValue() as string) : "-"),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {onEdit ? <Button variant="ghost" size="sm" onClick={() => onEdit(row.original)}>Edit</Button> : null}
          {onPay && row.original.paymentStatus !== "PAID" ? (
            <Button variant="outline" size="sm" onClick={() => onPay(row.original)}>
              <CheckCircle className="mr-1 h-4 w-4" /> Bayar
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => {
                if (window.confirm("Hapus supplier cost ini?")) onDelete(row.original);
              }}
            >
              Hapus
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" title="Upload nota">
            <Upload className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ], [onEdit, onPay, onDelete]);

  return <DataTable columns={columns} data={rows as SupplierCost[]} searchPlaceholder="Cari supplier..." emptyMessage="Belum ada supplier cost." />;
}
