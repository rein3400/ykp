"use client";

import { useMemo } from "react";
import { Users, Clock, AlertTriangle, CalendarX, Wallet } from "lucide-react";
import { Card, CardContent, KpiCard } from "@ykp/ui";
import { useAttendance, usePayroll } from "@hr/features/api/queries";
import { todayWib } from "@hr/features/lib/wib";

/**
 * HR overview island. Drives the KPI cards on the dashboard with live
 * attendance + payroll queries. Falls back to zeros if the API is empty.
 */
export function HrOverviewClient(): JSX.Element {
  const today = useMemo(() => todayWib(), []);
  const attendanceQ = useAttendance({ date: today });
  const payrollQ = usePayroll({});

  const rows = attendanceQ.data?.attendance ?? [];
  const total = rows.length;
  const present = rows.filter((r) => r.attendanceStatus === "present").length;
  const late = rows.filter((r) => r.isLate).length;
  const absent = rows.filter((r) => r.attendanceStatus === "absent").length;
  const pendingPayroll = (payrollQ.data?.payroll ?? []).filter(
    (p) => p.approvalStatus === "PENDING" || p.approvalStatus === "DRAFT",
  ).length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard title="Total Karyawan" value={total} icon={<Users className="h-5 w-5" />} />
      <KpiCard title="Hadir Hari Ini" value={present} icon={<Clock className="h-5 w-5" />} />
      <KpiCard title="Terlambat" value={late} icon={<AlertTriangle className="h-5 w-5" />} />
      <KpiCard title="Tidak Hadir" value={absent} icon={<CalendarX className="h-5 w-5" />} />
      <KpiCard title="Pending Payroll" value={pendingPayroll} icon={<Wallet className="h-5 w-5" />} />

      <Card className="sm:col-span-2 lg:col-span-5">
        <CardContent className="text-sm text-muted-foreground">
          {attendanceQ.isLoading
            ? "Memuat data..."
            : `Snapshot ${today} · ${present}/${total} hadir, ${late} telat, ${absent} absen.`}
        </CardContent>
      </Card>
    </div>
  );
}