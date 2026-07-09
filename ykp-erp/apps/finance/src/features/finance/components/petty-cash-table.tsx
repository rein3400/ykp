/**
 * Petty cash ledger table with running balance / urgent flags and
 * approval actions.
 */
"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable, Button, Badge, formatIdr, formatDateWib } from "@ykp/ui";
import { usePettyCashList } from '../api/queries';
import { useApprovePettyCash } from '../api/mutations';
import { ApprovalStatusBadge, CurrencyCell } from './finance-shared';
import type { PettyCash } from '../api/types';

export interface PettyCashTableProps {
  params: URLSearchParams;
  onApprove?: (row: PettyCash) => void;
}

export function PettyCashTable({ params, onApprove }: PettyCashTableProps) {
  const { data = [], isLoading } = usePettyCashList(params);
  const rows = data as PettyCash[];

  const columns = React.useMemo<ColumnDef<PettyCash>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Tanggal",
        cell: ({ getValue }) => formatDateWib(getValue() as string),
      },
      { accessorKey: "outletName", header: "Outlet" },
      { accessorKey: "accountId", header: "Akun" },
      {
        accessorKey: "type",
        header: "Tipe",
        cell: ({ getValue }) => <Badge variant={getValue() === "in" ? "success" : "secondary"}>{getValue() as string}</Badge>,
      },
      {
        accessorKey: "amount",
        header: "Jumlah",
        cell: ({ getValue }) => <CurrencyCell value={getValue() as number} />,
      },
      { accessorKey: "description", header: "Keterangan" },
      {
        accessorKey: "urgentFlag",
        header: "Urgent",
        cell: ({ getValue }) => (getValue() ? <Badge variant="destructive">URGENT</Badge> : "-"),
      },
      {
        accessorKey: "approvalStatus",
        header: "Approval",
        cell: ({ getValue }) => <ApprovalStatusBadge status={getValue() as never} />,
      },
      {
        id: "actions",
        header: "Aksi",
        cell: ({ row }) =>
          row.original.urgentFlag && row.original.approvalStatus === "PENDING" && onApprove ? (
            <Button variant="outline" size="sm" onClick={() => onApprove(row.original)}>Approve</Button>
          ) : null,
      },
    ],
    [onApprove],
  );

  if (isLoading) return <div className="text-muted-foreground">Memuat petty cash...</div>;
  return <DataTable columns={columns} data={rows} searchPlaceholder="Cari transaksi..." emptyMessage="Belum ada transaksi petty cash." />;
}
