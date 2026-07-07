"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge, Button, DataTable, FilterBar, ExportButton, type FilterBarValue } from "@ykp/ui";
import { formatDateWib } from "@ykp/ui";
import { useAttendance, useCheckin, useCheckout } from "@/features/api/queries";
import { todayWib } from "@/features/lib/wib";
import type { AttendanceRow } from "@/features/api/types";

const statusColor: Record<string, string> = {
  present: "bg-success/10 text-success",
  absent: "bg-destructive/10 text-destructive",
  izin: "bg-warning/10 text-warning",
  sakit: "bg-warning/10 text-warning",
  cuti: "bg-primary/10 text-primary",
};

/**
 * Attendance client island. Filter + DataTable + check-in/out actions.
 * Reuses the @ykp/ui DataTable so column defs stay in this file.
 */
export function AttendanceTableClient(): JSX.Element {
  const [filters, setFilters] = React.useState<FilterBarValue>({
    brand: "ALL",
    outlet: "ALL",
    periode: todayWib(),
    shift: "ALL",
  });
  const { data, isLoading } = useAttendance({ date: filters.periode });
  const checkin = useCheckin();
  const checkout = useCheckout();

  const rows = data?.attendance ?? [];

  const columns = React.useMemo<ColumnDef<AttendanceRow>[]>(
    () => [
      {
        accessorKey: "employeeName",
        header: "Karyawan",
        cell: ({ row }) => row.original.employeeName ?? row.original.employeeId,
      },
      { accessorKey: "outletName", header: "Outlet" },
      {
        accessorKey: "checkIn",
        header: "Check-in",
        cell: ({ row }) =>
          row.original.checkIn ? formatDateWib(row.original.checkIn) : "-",
      },
      {
        accessorKey: "checkOut",
        header: "Check-out",
        cell: ({ row }) =>
          row.original.checkOut ? formatDateWib(row.original.checkOut) : "-",
      },
      {
        accessorKey: "isLate",
        header: "Telat",
        cell: ({ row }) =>
          row.original.isLate ? (
            <Badge className={statusColor.present}>{row.original.lateMinutes}m</Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        accessorKey: "overtimeHours",
        header: "Lembur",
        cell: ({ row }) => `${row.original.overtimeHours}j`,
      },
      {
        accessorKey: "attendanceStatus",
        header: "Status",
        cell: ({ row }) => (
          <Badge className={statusColor[row.original.attendanceStatus] ?? ""}>
            {row.original.attendanceStatus}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Aksi",
        cell: ({ row }) =>
          row.original.checkOut ? (
            <span className="text-xs text-muted-foreground">selesai</span>
          ) : row.original.checkIn ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                checkout.mutate({ attendanceId: row.original.attendanceId })
              }
            >
              Check-out
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() =>
                checkin.mutate({
                  employeeId: row.original.employeeId,
                  outletId: row.original.outletId,
                  shiftName: row.original.shiftName ?? undefined,
                })
              }
            >
              Check-in
            </Button>
          ),
      },
    ],
    [checkin, checkout],
  );

  return (
    <div className="space-y-4">
      <FilterBar
        outlets={[]}
        onChange={(next) => setFilters((prev) => ({ ...prev, periode: next.periode ?? prev.periode }))}
      />
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Cari karyawan..."
        pageSize={15}
        emptyMessage={isLoading ? "Memuat..." : "Belum ada kehadiran hari ini."}
        toolbar={<ExportButton label="Export" onExportCsv={() => exportCsv(rows)} />}
      />
    </div>
  );
}

/** Tiny CSV exporter for attendance rows. */
function exportCsv(rows: AttendanceRow[]): void {
  const header = ["employeeId", "employeeName", "outletName", "checkIn", "checkOut", "lateMinutes", "overtimeHours", "status"];
  const lines = rows.map((r) =>
    [
      r.employeeId,
      r.employeeName ?? "",
      r.outletName ?? "",
      r.checkIn ?? "",
      r.checkOut ?? "",
      r.lateMinutes,
      r.overtimeHours,
      r.attendanceStatus,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "attendance.csv";
  a.click();
  URL.revokeObjectURL(url);
}