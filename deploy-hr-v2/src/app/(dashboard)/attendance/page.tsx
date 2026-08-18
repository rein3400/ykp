import { AttendanceTableClient } from "@hr/features/components/attendance-table";

/**
 * Attendance page. Server component shell; the interactive table, filters
 * and check-in/out actions live in the client island so they can use
 * TanStack mutations.
 */
export default function AttendancePage(): JSX.Element {
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