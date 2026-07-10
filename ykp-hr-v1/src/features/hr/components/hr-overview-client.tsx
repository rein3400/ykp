'use client';

import { useMemo, useState } from 'react';
import type {
  Employee, Attendance, Leave, Roster,
  Brand, Outlet, DailySummary
} from '@/app/hr/page';

type Period = 'today' | '7d' | '30d';

function inRange(date: string, today: string, period: Period): boolean {
  if (period === 'today') return date === today;
  const days = period === '7d' ? 7 : 30;
  const t = new Date(today).getTime();
  const d = new Date(date).getTime();
  return d >= t - (days - 1) * 86400000 && d <= t;
}

export function HrOverviewClient(props: {
  employees: Employee[];
  attendance: Attendance[];
  leaves: Leave[];
  rosters: Roster[];
  brands: Brand[];
  outlets: Outlet[];
  recentSummary: DailySummary[];
  today: string;
  sessionBrandId: string;
  sessionOutletId: string;
}) {
  const { employees, attendance, leaves, rosters, brands, outlets, recentSummary, today, sessionBrandId, sessionOutletId } = props;

  // Scope defaults: if user has brand/outlet scope, lock to it (read-only).
  const [brandId, setBrandId] = useState<string>(sessionBrandId || 'all');
  const [outletId, setOutletId] = useState<string>(sessionOutletId || 'all');
  const [period, setPeriod] = useState<Period>('today');

  const lockedBySession = Boolean(sessionBrandId) || Boolean(sessionOutletId);

  const outletOptions = useMemo(() => {
    if (brandId === 'all') return outlets;
    return outlets.filter((o) => o.brand_id === brandId);
  }, [outlets, brandId]);

  // Filtered slices
  const empFiltered = useMemo(
    () => employees.filter((e) =>
      (e.active_status === '1' || e.active_status === 'active') &&
      (brandId === 'all' || e.brand_id === brandId) &&
      (outletId === 'all' || e.outlet_id === outletId)
    ),
    [employees, brandId, outletId]
  );

  const empIdSet = useMemo(() => new Set(empFiltered.map((e) => e.employee_id)), [empFiltered]);

  const attFiltered = useMemo(
    () => attendance.filter((a) =>
      empIdSet.has(a.employee_id) && inRange(a.date, today, period)
    ),
    [attendance, empIdSet, today, period]
  );

  const leaveFiltered = useMemo(
    () => leaves.filter((l) =>
      empIdSet.has(l.employee_id) && (
        (l.approval_status === 'APPROVED' && l.start_date <= today && l.end_date >= today)
        || inRange(l.start_date, today, period)
      )
    ),
    [leaves, empIdSet, today, period]
  );

  const rosterFiltered = useMemo(
    () => rosters.filter((r) => empIdSet.has(r.employee_id) && inRange(r.date, today, period)),
    [rosters, empIdSet, today, period]
  );

  // KPIs
  const present = attFiltered.filter((a) =>
    a.attendance_status === 'PRESENT' || a.attendance_status === 'LATE'
  ).length;
  const late = attFiltered.filter((a) => a.attendance_status === 'LATE').length;
  const absent = Math.max(0, empFiltered.length - present);
  const incomplete = attFiltered.filter((a) => !a.actual_check_out).length;
  const onLeave = leaveFiltered.filter((l) =>
    l.approval_status === 'APPROVED' && l.start_date <= today && l.end_date >= today
  ).length;
  const shiftShortage = rosterFiltered.filter((r) => !r.shift_id || r.roster_status === 'ABSENT').length;

  const kpis = [
    { label: `Total Karyawan Aktif${period !== 'today' ? ' (filtered)' : ''}`, value: empFiltered.length, tone: 'gray' as const },
    { label: `Hadir (${period === 'today' ? today : period})`, value: present, tone: 'green' as const },
    { label: 'Telat', value: late, tone: late > 0 ? 'yellow' : 'gray' as const },
    { label: 'Absen / Alpha', value: absent, tone: absent > 0 ? 'red' : 'gray' as const },
    { label: 'Izin / Cuti Aktif', value: onLeave, tone: 'gray' as const },
    { label: 'Belum Checkout', value: incomplete, tone: incomplete > 0 ? 'yellow' : 'gray' as const },
    { label: 'Shift Shortage', value: shiftShortage, tone: shiftShortage > 0 ? 'red' : 'gray' as const }
  ];

  // Filter recent summary by brand/outlet (period only affects in-memory KPIs above; daily summary is already aggregated by date)
  const summaryFiltered = useMemo(
    () => recentSummary.filter((s) =>
      (brandId === 'all' || s.brand_id === brandId) &&
      (outletId === 'all' || s.outlet_id === outletId)
    ),
    [recentSummary, brandId, outletId]
  );

  return (
    <div className='space-y-4'>
      <div className='card flex flex-wrap items-end gap-3'>
        <label className='text-sm'>
          Brand
          <select
            className='input mt-1'
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value);
              setOutletId('all');
            }}
            disabled={Boolean(sessionBrandId)}
          >
            <option value='all'>Semua Brand</option>
            {brands.map((b) => (
              <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>
            ))}
          </select>
        </label>
        <label className='text-sm'>
          Outlet
          <select
            className='input mt-1'
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            disabled={Boolean(sessionOutletId)}
          >
            <option value='all'>Semua Outlet</option>
            {outletOptions.map((o) => (
              <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>
            ))}
          </select>
        </label>
        <label className='text-sm'>
          Periode
          <select
            className='input mt-1'
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
          >
            <option value='today'>Hari ini</option>
            <option value='7d'>7 hari terakhir</option>
            <option value='30d'>30 hari terakhir</option>
          </select>
        </label>
        {lockedBySession && (
          <div className='ml-auto text-xs text-muted-foreground'>
            Scope otomatis dari sesi (brand/outlet terbatas).
          </div>
        )}
      </div>

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {kpis.map((k) => (
          <div key={k.label} className='card'>
            <div className='text-xs text-muted-foreground'>{k.label}</div>
            <div className='mt-1 text-2xl font-bold'>{k.value}</div>
          </div>
        ))}
      </div>

      <div className='card'>
        <h2 className='mb-2 font-semibold'>HR Daily Summary (30 hari terakhir)</h2>
        {summaryFiltered.length === 0 ? (
          <div className='text-sm text-muted-foreground'>
            Belum ada summary. Jalankan regenerate di halaman Summary.
          </div>
        ) : (
          <table className='w-full text-sm'>
            <thead className='text-left text-xs text-muted-foreground'>
              <tr>
                <th className='py-2'>Tanggal</th>
                <th>Brand</th>
                <th>Outlet</th>
                <th>Hadir</th>
                <th>Telat</th>
                <th>Absen</th>
                <th>Telat (min)</th>
                <th>Issue</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {summaryFiltered.map((r, i) => (
                <tr key={`${r.date}-${r.outlet_id}-${i}`} className='border-t border-border'>
                  <td className='py-1'>{r.date}</td>
                  <td>{r.brand_name || r.brand_id}</td>
                  <td>{r.outlet_name || r.outlet_id}</td>
                  <td>{r.staff_present}</td>
                  <td>{r.staff_late}</td>
                  <td>{r.staff_absent}</td>
                  <td>{r.total_late_minutes}</td>
                  <td className='text-yellow-700'>{r.major_hr_issue || '-'}</td>
                  <td className='text-muted-foreground'>{r.recommended_action || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}