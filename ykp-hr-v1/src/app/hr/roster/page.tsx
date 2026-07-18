import { readTab, TABS } from '@/db/sheets';
import { todayWib } from '@/lib/format';
import { shiftLabel, type ShiftLike } from '@/lib/shift-label';
import { RosterForm } from '@/features/hr/components/roster-form';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';

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
    readTab<ShiftLike>(TABS.shifts),
    readTab<Roster>(TABS.roster),
  ]);
  const active = employees
    .filter((e) => e.active_status === 'active' || e.active_status === '1')
    .map((e) => ({ id: e.employee_id, name: e.full_name }));
  const shiftById = new Map(shifts.map((s) => [s.shift_id || '', s]));
  const today = todayWib();
  const todayRoster = rosters
    .filter((r) => r.date === today)
    .sort((a, b) => (a.employee_id ?? '').localeCompare(b.employee_id ?? ''));

  const upcoming = rosters
    .filter((r) => r.date > today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 20);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Shift & Roster</h1>
        <p className="text-sm text-muted-foreground">Jadwal harian per outlet.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card">
          <h2 className="mb-2 font-semibold">Buat Roster</h2>
          <RosterForm employees={active} shifts={shifts} />
        </div>
        <div className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Roster Hari Ini ({today})</h2>
          <DataTable
            data={todayRoster}
            rowKey={(r) => r.roster_id}
            empty="Belum ada roster untuk hari ini."
            columns={[
              { key: 'emp', header: 'Karyawan', render: (r) => r.employee_name || r.employee_id },
              {
                key: 'shift',
                header: 'Shift',
                render: (r) => shiftLabel(shiftById.get(r.shift_id) ?? r.shift_id),
              },
              {
                key: 'status',
                header: 'Status',
                render: (r) => <StatusBadge status={r.roster_status || 'SCHEDULED'} />,
              },
              {
                key: 'notes',
                header: 'Notes',
                render: (r) => <span className="text-muted-foreground">{r.notes || '-'}</span>,
              },
            ]}
          />
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Upcoming Roster (20 berikutnya)</h2>
        <DataTable
          data={upcoming}
          rowKey={(r) => r.roster_id}
          empty="Tidak ada jadwal ke depan."
          columns={[
            {
              key: 'date',
              header: 'Tanggal',
              render: (r) => <span className="font-mono text-xs">{r.date}</span>,
            },
            { key: 'emp', header: 'Karyawan', render: (r) => r.employee_name || r.employee_id },
            {
              key: 'shift',
              header: 'Shift',
              render: (r) => shiftLabel(shiftById.get(r.shift_id) ?? r.shift_id),
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) => <StatusBadge status={r.roster_status || 'SCHEDULED'} />,
            },
          ]}
        />
      </div>
    </div>
  );
}