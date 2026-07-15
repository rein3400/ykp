"use client";

import * as React from "react";
import { Button } from "@ykp/ui";
import { AttendanceTableClient } from "@hr/features/components/attendance-table";
import { useAttendance } from "@hr/features/api/queries";
import { todayWib } from "@hr/features/lib/wib";

/**
 * Attendance page. Shows contextual empty state with action buttons when
 * no attendance data exists, otherwise renders the interactive table.
 */
export default function AttendancePage(): JSX.Element {
  const today = todayWib();
  const { data, isLoading } = useAttendance({ date: today });
  const rows = data?.attendance ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            Kehadiran per outlet hari ini. Check-in / check-out real-time via API.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Memuat...</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            Kehadiran per outlet hari ini. Check-in / check-out real-time via API.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 rounded-lg border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground max-w-md">
            Belum ada data absensi. Import CSV atau tambah manual untuk memulai.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/hr/employees">Import CSV (Employees)</a>
            </Button>
            <Button size="sm" asChild>
              <a href="/hr/attendance">Refresh</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Kehadiran per outlet hari ini. Check-in / check-out real-time via API.
        </p>
      </div>
      <AttendanceTableClient />
    </div>
  );
}
