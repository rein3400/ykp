/**
 * Receipt-level drill-down table for a single (date, outlet).
 * Shows verify / delete actions and photo thumbnail.
 */
"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  formatIdr,
  Badge,
} from "@ykp/ui";
import { CheckCircle2, Trash2, Image as ImageIcon } from "lucide-react";
import { usePosReceipts } from "../api/queries";
import { useDeletePosReceipt, useVerifyPosReceipt } from "../api/mutations";
import type { PosReceipt } from "../api/types";

export interface PosReceiptTableProps {
  date: string;
  outletId: string;
}

function toDateStr(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

export function PosReceiptTable({ date, outletId }: PosReceiptTableProps) {
  const params = React.useMemo(() => {
    const p = new URLSearchParams();
    p.set("date", toDateStr(date));
    p.set("outlet_id", outletId);
    p.set("limit", "200");
    return p;
  }, [date, outletId]);

  const { data = [], isLoading } = usePosReceipts(params);
  const verify = useVerifyPosReceipt();
  const del = useDeletePosReceipt();
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const columns = React.useMemo<ColumnDef<PosReceipt>[]>(
    () => [
      {
        accessorKey: "receiptNumber",
        header: "No. Nota",
      },
      {
        accessorKey: "transactionTime",
        header: "Waktu",
        cell: ({ getValue }) => (getValue() as string) || "-",
      },
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
        accessorKey: "paymentMethodId",
        header: "Payment",
        cell: ({ row }) => {
          const r = row.original;
          return `${r.paymentMethodId ?? "-"} (${formatIdr(r.paymentAmount ?? 0)})`;
        },
      },
      {
        accessorKey: "cashier",
        header: "Kasir",
        cell: ({ getValue }) => (getValue() as string) || "-",
      },
      {
        accessorKey: "shift",
        header: "Shift",
        cell: ({ getValue }) => (getValue() as string) || "-",
      },
      {
        accessorKey: "source",
        header: "Source",
      },
      {
        id: "verified",
        header: "Status",
        cell: ({ row }) =>
          row.original.verifiedBy ? (
            <Badge variant="secondary">Verified</Badge>
          ) : (
            <Badge variant="outline">Pending</Badge>
          ),
      },
      {
        id: "photo",
        header: "Foto",
        cell: ({ row }) =>
          row.original.photoUrl ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-primary underline"
              onClick={() => setPhotoUrl(row.original.photoUrl!)}
            >
              <ImageIcon className="h-3 w-3" /> Lihat
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          ),
      },
      {
        id: "actions",
        header: "Aksi",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center gap-1">
              {!r.verifiedBy && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={verify.isPending}
                  onClick={() => {
                    setActionError(null);
                    verify.mutate(r.receiptId, {
                      onError: (err) =>
                        setActionError(err instanceof Error ? err.message : "Verify gagal"),
                    });
                  }}
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Verify
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={del.isPending}
                onClick={() => {
                  if (!window.confirm(`Hapus struk ${r.receiptNumber}?`)) return;
                  setActionError(null);
                  del.mutate(r.receiptId, {
                    onError: (err) =>
                      setActionError(err instanceof Error ? err.message : "Delete gagal"),
                  });
                }}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          );
        },
      },
    ],
    [verify, del],
  );

  if (isLoading) {
    return <p className="px-2 py-3 text-xs text-muted-foreground">Memuat struk...</p>;
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2">
      {actionError && (
        <p className="px-1 text-xs text-destructive">{actionError}</p>
      )}
      <DataTable
        columns={columns}
        data={data}
        pageSize={20}
        searchPlaceholder="Cari struk..."
        emptyMessage="Belum ada struk individual untuk hari/outlet ini."
      />
      <Dialog open={!!photoUrl} onOpenChange={(v) => !v && setPhotoUrl(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Foto Nota</DialogTitle>
          </DialogHeader>
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Foto nota" className="max-h-[70vh] w-full rounded-md object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
