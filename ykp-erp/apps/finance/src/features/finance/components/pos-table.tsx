/**
 * POS daily revenue table with search, inline totals, and action slots.
 */
"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, formatIdr, formatDateWib } from "@ykp/ui";
import { usePosList } from '../api/queries';
import type { PosDaily } from '../api/types';

export interface PosTableProps {
  params: URLSearchParams;
  toolbar?: React.ReactNode;
}

export function PosTable({ params, toolbar }: PosTableProps) {
  const { data = [], isLoading } = usePosList(params);
  const rows = data as PosDaily[];

  const columns = React.useMemo<ColumnDef<PosDaily>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Tanggal",
        cell: ({ getValue }) => formatDateWib(getValue() as string),
      },
      { accessorKey: "brandName", header: "Brand" },
      { accessorKey: "outletName", header: "Outlet" },
      {
        accessorKey: "grossSales",
        header: "Gross",
        cell: ({ getValue }) => formatIdr(getValue() as number),
      },
      {
        accessorKey: "netSales",
        header: "Net",
        cell: ({ getValue }) => formatIdr(getValue() as number),
      },
      {
        accessorKey: "discount",
        header: "Diskon",
        cell: ({ getValue }) => formatIdr(getValue() as number),
      },
      {
        accessorKey: "refund",
        header: "Refund",
        cell: ({ getValue }) => formatIdr(getValue() as number),
      },
      {
        accessorKey: "void",
        header: "Void",
        cell: ({ getValue }) => formatIdr(getValue() as number),
      },
      {
        accessorKey: "paymentMethodBreakdown",
        header: "Payment",
        cell: ({ getValue }) => {
          const b = getValue() as Record<string, number> | null;
          if (!b) return "-";
          const top = Object.entries(b).sort((a, b) => b[1] - a[1])[0];
          return top ? `${top[0]} (${formatIdr(top[1])})` : "-";
        },
      },
      { accessorKey: "transactionCount", header: "Tx" },
      {
        accessorKey: "aov",
        header: "AOV",
        cell: ({ getValue }) => formatIdr(getValue() as number),
      },
      { accessorKey: "cashier", header: "Kasir" },
      { accessorKey: "shift", header: "Shift" },
      { accessorKey: "source", header: "Source" },
    ],
    [],
  );

  return <DataTable columns={columns} data={rows} toolbar={toolbar} searchPlaceholder="Cari transaksi..." emptyMessage="Belum ada data POS." />;
}