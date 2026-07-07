import { readTab, TABS } from '@/db/sheets';
import { todayWib } from '@/lib/format';
import { RosterForm } from '@/features/hr/components/roster-form';

export const dynamic = 'force-dynamic';

interface Roster {
  roster_id: string;
  date: string;
  employee_id: string;
  employee_name: string;
  shift_id: string;
  roster_status: string;
  notes: string;
}

export default async function RosterPage() {
  const [employees, shifts, rosters] = await Promise.all([
    readTab<{ employee_id: string; full_name: string; active_status: string }>(TABS.employees),
    readTab<{ shift_id: string; shift_name: string }>(TABS.shifts),
    readTab<Roster>(TABS.roster)
  ]);
  const active = employees
    .filter((e) => e.active_status === 'active' || e.active_status === '1')
    .map((e) => ({ id: e.employee_id, name: e.full_name }));
  const today = todayWib();
  const todayRoster = rosters.filter((r) => r.date === today).sort((a, b) => a.employee_name.localeCompare(b.employee_name));

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Shift & Roster</h1>
        <p className='text-sm text-muted-foreground'>Jadwal harian per outlet.</p>
      </div>

      <div className='grid gap-4 lg:grid-cols-3'>
        <div className='card'>
          <RosterForm employees={active} shifts={shifts} />
        </div>
        <div className='card lg:col-span-2'>
          <h2 className='mb-2 font-semibold'>Roster Hari Ini ({today})</h2>
          {todayRoster.length === 0 ? (
            <div className='text-sm text-muted-foreground'>Belum ada roster untuk hari ini.</div>
          ) : (
            <table className='w-full text-sm'>
              <thead className='text-left text-xs text-muted-foreground'>
                <tr>
                  <th className='py-2'>Karyawan</th>
                  <th>Shift</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {todayRoster.map((r) => (
                  <tr key={r.roster_id} className='border-t border-border'>
                    <td className='py-1'>{r.employee_name || r.employee_id}</td>
                    <td>{r.shift_id}</td>
                    <td><span className='badge-yellow'>{r.roster_status || 'SCHEDULED'}</span></td>
                    <td className='text-muted-foreground'>{r.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}