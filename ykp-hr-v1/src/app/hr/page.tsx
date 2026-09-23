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

  // Degrade gracefully per tab: satu tab DB jebol (mis. master_employee /
  // master_brand pasca-migrasi PG) tidak boleh merobohkan seluruh halaman.
  // Tab gagal tampil kosong + banner menyebut namanya (observable).
  const results = await Promise.allSettled([
    readTab<Employee>(TABS.employees),
    readTab<Attendance>(TABS.attendance),
    readTab<Leave>(TABS.leaves),
    readTab<Roster>(TABS.roster),
    readTab<Brand>(TABS.brands),
    readTab<Outlet>(TABS.outlets),
    readTab<DailySummary>(TABS.dailySummary)
  ]);

  const failedTabs: string[] = [];
  const pick = <T,>(r: PromiseSettledResult<T[]>, tab: string): T[] => {
    if (r.status === 'fulfilled') return r.value;
    failedTabs.push(tab);
    // Log the failed tab, not raw database errors that may contain connection details.
    console.error(`[hr/overview] readTab ${tab} failed, degrading to empty`);
    return [];
  };
  const [rEmp, rAtt, rLea, rRos, rBra, rOut, rSum] = results;
  const employees = pick<Employee>(rEmp, TABS.employees);
  const attendance = pick<Attendance>(rAtt, TABS.attendance);
  const leaves = pick<Leave>(rLea, TABS.leaves);
  const rosters = pick<Roster>(rRos, TABS.roster);
  const brands = pick<Brand>(rBra, TABS.brands);
  const outlets = pick<Outlet>(rOut, TABS.outlets);
  const latestSummary = pick<DailySummary>(rSum, TABS.dailySummary);

  const today = todayWib();
  const recent = latestSummary.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  // Scope server-side so non-admin roles never receive out-of-scope data,
  // even if the client filter is bypassed.
  const role = session.role;
  let scopedEmployees = employees;
  let scopedOutlets = outlets;
  let scopedAttendance = attendance;
  let scopedLeaves = leaves;
  let scopedRosters = rosters;
  let scopedSummary = recent;
  if (role === 'outlet_manager' || role === 'supervisor') {
    scopedEmployees = employees.filter((e) => e.outlet_id === session.outletId);
    scopedOutlets = outlets.filter((o) => o.outlet_id === session.outletId);
    scopedSummary = recent.filter((s) => s.outlet_id === session.outletId);
  } else if (role === 'brand_manager') {
    scopedEmployees = employees.filter((e) => e.brand_id === session.brandId);
    scopedOutlets = outlets.filter((o) => o.brand_id === session.brandId);
    scopedSummary = recent.filter((s) => s.brand_id === session.brandId);
  } else if (role === 'employee') {
    // Employee sees only their own outlet's aggregate (self-only attendance
    // is enforced at the API; the overview is read-only scope).
    scopedEmployees = session.outletId ? employees.filter((e) => e.outlet_id === session.outletId) : [];
    scopedOutlets = session.outletId ? outlets.filter((o) => o.outlet_id === session.outletId) : [];
    scopedSummary = session.outletId ? recent.filter((s) => s.outlet_id === session.outletId) : [];
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>HR Overview</h1>
        <p className='text-sm text-muted-foreground'>Snapshot harian untuk owner, HR admin, manager.</p>
      </div>
      {failedTabs.length > 0 && (
        <div className='rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800'>
          Sebagian data gagal dimuat ({failedTabs.join(', ')}). Halaman tampil sebagian — cek DB/env VPS lalu muat ulang.
        </div>
      )}

      <HrOverviewClient
        employees={scopedEmployees}
        attendance={scopedAttendance}
        leaves={scopedLeaves}
        rosters={scopedRosters}
        brands={brands}
        outlets={scopedOutlets}
        recentSummary={scopedSummary}
        today={today}
        sessionBrandId={session.brandId ?? ''}
        sessionOutletId={session.outletId ?? ''}
      />

      <div className='text-xs text-muted-foreground'>Generated {nowTimestampWib()} · scope: {session.brandId ?? 'all'} / {session.outletId ?? 'all'}</div>
    </div>
  );
}