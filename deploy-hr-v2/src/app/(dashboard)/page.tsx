import Link from "next/link";
import { Clock, Users, AlertTriangle, CalendarX, Wallet } from "lucide-react";
import { KpiCard, Card, CardContent, CardHeader, CardTitle, Button } from "../../../_packages/ui/src/index";
import { HrOverviewClient } from "@hr/features/components/hr-overview-client";

/**
 * HR overview page. KPI cards are driven by /api/hr/summary + /api/hr/payroll
 * via TanStack Query in the client island. The page itself is a server
 * component so the sidebar + header stay static on navigation.
 */
export default function DashboardPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">HR Overview</h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan kehadiran &amp; payroll hari ini.
          </p>
        </div>
        <Link href="/attendance">
          <Button size="sm">Buka attendance</Button>
        </Link>
      </div>

      <HrOverviewClient />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tren kehadiran 7 hari</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceTrendPlaceholder />
        </CardContent>
      </Card>
    </div>
  );
}

/** Lightweight inline-SVG placeholder until a chart lib is wired. */
function AttendanceTrendPlaceholder(): JSX.Element {
  const bars = [12, 15, 13, 16, 14, 11, 10];
  const max = Math.max(...bars);
  return (
    <div className="flex h-40 items-end gap-3">
      {bars.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-primary/80"
            style={{ height: `${(v / max) * 100}%` }}
          />
          <span className="text-[10px] text-muted-foreground">{v}</span>
        </div>
      ))}
    </div>
  );
}