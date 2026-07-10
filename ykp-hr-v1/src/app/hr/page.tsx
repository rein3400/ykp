import { readTab, TABS } from '@/db/sheets';
import { todayWib, nowTimestampWib } from '@/lib/format';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { HrOverviewClient } from '@/features/hr/components/hr-overview-client';

export const dynamic = 'force-dynamic';

export interface Employee { employee_id: string; full_name: string; brand_id: string; outlet_id: string; active_status: string }
export interface Attendance {
  attendance_id: string; date: string; employee_id: string; outlet_id: string;
  attendance_status: string; late_minutes: string; actual_check_out: string;
}
export interface Leave {
  leave_id: string; employee_id: string; outlet_id: string; brand_id: string;
  start_date: string; end_date: string; approval_status: string;
}
export interface Roster {
  roster_id: string; date: string; employee_id: string; outlet_id: string;
  shift_id: string; roster_status: string;
}
export interface Brand { brand_id: string; brand_name: string }
export interface Outlet { outlet_id: string; brand_id: string; outlet_name: string }
export interface DailySummary {
  date: string; brand_id: string; brand_name: string;
  outlet_id: string; outlet_name: string;
  staff_present: string; staff_late: string; staff_absent: string;
  total_late_minutes: string; major_hr_issue: string; recommended_action: string;
}

export default async function HrOverview() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [employees, attendance, leaves, rosters, brands, outlets, latestSummary] = await Promise.all([
    readTab<Employee>(TABS.employees),
    readTab<Attendance>(TABS.attendance),
    readTab<Leave>(TABS.leaves),
    readTab<Roster>(TABS.roster),
    readTab<Brand>(TABS.brands),
    readTab<Outlet>(TABS.outlets),
    readTab<DailySummary>(TABS.dailySummary)
  ]);

  const today = todayWib();
  const recent = latestSummary.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>HR Overview</h1>
        <p className='text-sm text-muted-foreground'>Snapshot harian untuk owner, HR admin, manager.</p>
      </div>

      <HrOverviewClient
        employees={employees}
        attendance={attendance}
        leaves={leaves}
        rosters={rosters}
        brands={brands}
        outlets={outlets}
        recentSummary={recent}
        today={today}
        sessionBrandId={session.brandId ?? ''}
        sessionOutletId={session.outletId ?? ''}
      />

      <div className='text-xs text-muted-foreground'>Generated {nowTimestampWib()} · scope: {session.brandId ?? 'all'} / {session.outletId ?? 'all'}</div>
    </div>
  );
}