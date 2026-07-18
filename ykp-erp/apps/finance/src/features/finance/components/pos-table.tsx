/**
 * POS daily revenue table with expandable drill-down to individual receipts.
 */
"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button, DataTable, formatIdr, formatDateWib } from "@ykp/ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import { usePosList } from "../api/queries";
import type { PosDaily } from "../api/types";
import { PosReceiptTable } from "./pos-receipt-table";

export interface PosTableProps {
  params: URLSearchParams;
  toolbar?: React.ReactNode;
}

function toDateStr(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

export function PosTable({ params, toolbar }: PosTableProps) {
  const { data = [] } = usePosList(params);
  const rows = data as PosDaily[];
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const columns = React.useMemo<ColumnDef<PosDaily>[]>(
    () => [
      {
        id: "expand",
        header: "",
        cell: ({ row }) => {
          const r = row.original;
          const key = `${toDateStr(r.date)}::${r.outletId}`;
          const isOpen = expanded.has(key);
          return (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={isOpen ? "Tutup detail struk" : "Buka detail struk"}
              onClick={() => toggle(key)}
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          );
        },
      },
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
    [expanded],
  );

  // DataTable has no built-in expand; render expanded panels below matching rows.
  const expandedRows = rows.filter((r) => expanded.has(`${toDateStr(r.date)}::${r.outletId}`));

  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        data={rows}
        toolbar={toolbar}
        searchPlaceholder="Cari transaksi..."
        emptyMessage="Belum ada data POS."
      />
      {expandedRows.map((r) => {
        const key = `${toDateStr(r.date)}::${r.outletId}`;
        return (
          <div key={key} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Struk · {r.outletName} · {toDateStr(r.date)}
            </p>
            <PosReceiptTable date={toDateStr(r.date)} outletId={r.outletId} />
          </div>
        );
      })}
    </div>
  );
}
