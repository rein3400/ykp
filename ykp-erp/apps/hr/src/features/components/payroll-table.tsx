"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@ykp/ui";
import { formatIdr } from "@ykp/ui";
import {
  usePayroll,
  useRunPayroll,
  useApprovePayroll,
} from "@hr/features/api/queries";
import type { PayrollRow } from "@hr/features/api/types";

const statusColor: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING: "bg-warning/10 text-warning",
  APPROVED: "bg-success/10 text-success",
  REJECTED: "bg-destructive/10 text-destructive",
  PAID: "bg-primary/10 text-primary",
};

/**
 * Payroll client island. Renders the data table, an approval inbox,
 * a generate-payroll modal, and a gross/net mini-chart placeholder.
 */
export function PayrollTableClient(): JSX.Element {
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const { data, isLoading } = usePayroll({});
  const run = useRunPayroll();
  const approve = useApprovePayroll();

  const rows = data?.payroll ?? [];

  const grossTotal = rows.reduce((acc, r) => acc + r.grossSalary, 0);
  const netTotal = rows.reduce((acc, r) => acc + r.netSalary, 0);

  const columns = React.useMemo<ColumnDef<PayrollRow>[]>(
    () => [
      {
        accessorKey: "employeeName",
        header: "Karyawan",
        cell: ({ row }) => row.original.employeeName ?? row.original.employeeId,
      },
      { accessorKey: "periodStart", header: "Periode Mulai" },
      { accessorKey: "periodEnd", header: "Periode Selesai" },
      {
        accessorKey: "attendanceCount",
        header: "Hadir",
        cell: ({ row }) => `${row.original.attendanceCount}/${row.original.payrollDays}`,
      },
      {
        accessorKey: "grossSalary",
        header: "Gross",
        cell: ({ row }) => formatIdr(row.original.grossSalary),
      },
      {
        accessorKey: "netSalary",
        header: "Net",
        cell: ({ row }) => formatIdr(row.original.netSalary),
      },
      {
        accessorKey: "approvalStatus",
        header: "Approval",
        cell: ({ row }) => (
          <Badge className={statusColor[row.original.approvalStatus] ?? ""}>
            {row.original.approvalStatus}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Aksi",
        cell: ({ row }) =>
          row.original.approvalStatus === "DRAFT" ||
          row.original.approvalStatus === "PENDING" ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => approve.mutate({ id: row.original.payrollId, decision: "APPROVE" })}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => approve.mutate({ id: row.original.payrollId, decision: "REJECT" })}
              >
                Reject
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">selesai</span>
          ),
      },
    ],
    [approve],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Gross</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatIdr(grossTotal)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Net</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatIdr(netTotal)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Generate Payroll</CardTitle>
          </CardHeader>
          <CardContent>
            <GeneratePayrollDialog
              onSubmit={(period_start, period_end) =>
                run.mutate({ periodStart: period_start, periodEnd: period_end })
              }
              loading={run.isPending}
            />
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Cari karyawan..."
        pageSize={15}
        emptyMessage={isLoading ? "Memuat..." : "Belum ada data payroll."}
      />
    </div>
  );
}

function GeneratePayrollDialog({
  onSubmit,
  loading,
}: {
  onSubmit: (periodStart: string, periodEnd: string) => void;
  loading: boolean;
}): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Generate</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Payroll</DialogTitle>
          <DialogDescription>
            Hitung gaji seluruh karyawan aktif untuk periode ini.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="Periode mulai"
          />
          <Input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder="Periode selesai"
          />
        </div>
        <DialogFooter>
          <Button
            disabled={!start || !end || loading}
            onClick={() => {
              onSubmit(start, end);
              setOpen(false);
            }}
          >
            {loading ? "Memproses..." : "Run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}