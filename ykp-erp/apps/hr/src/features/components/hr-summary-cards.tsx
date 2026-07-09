"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge, Button, Card, CardContent, DataTable, Input } from "@ykp/ui";
import { useHrSummary, useRebuildSummary } from "@hr/features/api/queries";
import { todayWib } from "@hr/features/lib/wib";
import type { HrDailySummaryRow } from "@hr/features/api/types";

/**
 * HR daily summary island. Grid of hr_daily_summary rows + a rebuild
 * control that calls POST /api/hr/summary to regenerate idempotently.
 */
export function HrSummaryClient(): JSX.Element {
  const [date, setDate] = React.useState(todayWib());
  const { data, isLoading } = useHrSummary({ date });
  const rebuild = useRebuildSummary();

  const rows = data?.summaries ?? [];

  const columns = React.useMemo<ColumnDef<HrDailySummaryRow>[]>(
    () => [
      { accessorKey: "date", header: "Tanggal" },
      { accessorKey: "brand", header: "Brand" },
      { accessorKey: "outlet", header: "Outlet" },
      { accessorKey: "totalStaff", header: "Total" },
      { accessorKey: "staffPresent", header: "Hadir" },
      {
        accessorKey: "staffLate",
        header: "Telat",
        cell: ({ row }) =>
          row.original.staffLate > 0 ? (
            <Badge className="bg-warning/10 text-warning">{row.original.staffLate}</Badge>
          ) : (
            <span className="text-muted-foreground">0</span>
          ),
      },
      {
        accessorKey: "staffAbsent",
        header: "Absen",
        cell: ({ row }) =>
          row.original.staffAbsent > 0 ? (
            <Badge className="bg-destructive/10 text-destructive">{row.original.staffAbsent}</Badge>
          ) : (
            <span className="text-muted-foreground">0</span>
          ),
      },
      {
        accessorKey: "payrollIssue",
        header: "Issue",
        cell: ({ row }) =>
          row.original.payrollIssue === "none" ? (
            <span className="text-muted-foreground">-</span>
          ) : (
            <Badge>{row.original.payrollIssue}</Badge>
          ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Tanggal</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <Button
            onClick={() => rebuild.mutate({ date })}
            disabled={rebuild.isPending}
          >
            {rebuild.isPending ? "Rebuilding..." : "Rebuild"}
          </Button>
          {rebuild.isSuccess ? (
            <span className="text-xs text-success">
              Rebuilt {rebuild.data.rebuilt} outlet(s).
            </span>
          ) : null}
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Cari outlet..."
        pageSize={15}
        emptyMessage={isLoading ? "Memuat..." : "Belum ada summary untuk tanggal ini."}
      />
    </div>
  );
}