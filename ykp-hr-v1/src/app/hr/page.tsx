import { readTab, TABS } from '@/db/sheets';
import { formatIdr, todayWib, nowTimestampWib } from '@/lib/format';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Employee { employee_id: string; full_name: string; outlet_id: string; active_status: string }
interface Attendance { attendance_id: string; date: string; employee_id: string; status: string; late_minutes: string; actual_check_out: string }
interface Leave { leave_id: string; employee_id: string; start_date: string; end_date: string; approval_status: string }
interface Roster { roster_id: string; date: string; employee_id: string; shift_id: string; roster_status: string }
interface Shift { shift_id: string; outlet_id: string }
interface DailySummary { date: string; outlet_id: string; staff_present: string; staff_late: string; staff_absent: string; major_hr_issue: string; recommended_action: string; total_late_minutes: string }

export default async function HrOverview() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [employees, attendance, leaves, rosters, shifts, latestSummary] = await Promise.all([
    readTab<Employee>(TABS.employees),
    readTab<Attendance>(TABS.attendance),
    readTab<Leave>(TABS.leaves),
    readTab<Roster>(TABS.roster),
    readTab<Shift>(TABS.shifts),
    readTab<DailySummary>(TABS.dailySummary)
  ]);

  const activeEmployees = employees.filter((e) => e.active_status === '1' || e.active_status === 'active');
  const today = todayWib();
  const todayAtt = attendance.filter((a) => a.date === today);
  const present = todayAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
  const late = todayAtt.filter((a) => a.status === 'late').length;
  const absent = Math.max(0, activeEmployees.length - present);
  const incomplete = todayAtt.filter((a) => !a.actual_check_out).length;
  const todayLeave = leaves.filter((l) => l.approval_status === 'APPROVED' && l.start_date <= today && l.end_date >= today);
  const shiftShortage = (() => {
    const todayRoster = rosters.filter((r) => r.date === today);
    const unfilled = todayRoster.filter((r) => !r.shift_id || r.roster_status === 'ABSENT');
    return unfilled.length;
  })();

  const recent = latestSummary
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  const kpis = [
    { label: 'Total Karyawan Aktif', value: activeEmployees.length, tone: 'gray' as const },
    { label: `Hadir Hari Ini (${today})`, value: present, tone: 'green' as const },
    { label: 'Telat Hari Ini', value: late, tone: late > 0 ? 'yellow' : 'gray' as const },
    { label: 'Absen / Tanpa Keterangan', value: absent, tone: absent > 0 ? 'red' : 'gray' as const },
    { label: 'Izin / Cuti Hari Ini', value: todayLeave.length, tone: 'gray' as const },
    { label: 'Belum Checkout', value: incomplete, tone: incomplete > 0 ? 'yellow' : 'gray' as const },
    { label: 'Shift Shortage', value: shiftShortage, tone: shiftShortage > 0 ? 'red' : 'gray' as const }
  ];

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>HR Overview</h1>
        <p className='text-sm text-muted-foreground'>Snapshot harian untuk owner, HR admin, manager.</p>
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
        <h2 className='mb-2 font-semibold'>HR Daily Summary (7 hari terakhir)</h2>
        {recent.length === 0 ? (
          <div className='text-sm text-muted-foreground'>Belum ada summary. Jalankan regenerate di halaman Summary.</div>
        ) : (
          <table className='w-full text-sm'>
            <thead className='text-left text-xs text-muted-foreground'>
              <tr>
                <th className='py-2'>Tanggal</th>
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
              {recent.map((r, i) => (
                <tr key={i} className='border-t border-border'>
                  <td className='py-1'>{r.date}</td>
                  <td>{r.outlet_id}</td>
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

      <div className='text-xs text-muted-foreground'>Generated {nowTimestampWib()} · scope: {session.brandId ?? 'all'} / {session.outletId ?? 'all'}</div>
    </div>
  );
}