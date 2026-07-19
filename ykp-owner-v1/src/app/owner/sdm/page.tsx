/** /owner/sdm — presence / late / absent / leave per outlet today. */
import { getOverview } from '@/lib/aggregate';
import { consolidateHr } from '@/lib/consolidate';
import { formatDateShort, formatTimeHm } from '@/lib/format';
import { MODULES, moduleUrl } from '@/lib/modules';
import { Card, EmptyState, SourceTag, StatusDot } from '@/components/ui';
import { FilterableRows, type Column } from '@/components/filterable-rows';
import { MockBanner } from '@/components/banners';

export const dynamic = 'force-dynamic';

const COLUMNS: Column[] = [
  { key: 'scheduled_staff', label: 'Terjadwal' },
  { key: 'staff_present', label: 'Hadir' },
  { key: 'staff_late', label: 'Telat' },
  { key: 'staff_absent', label: 'Absen' },
  { key: 'staff_leave', label: 'Cuti' },
  { key: 'shift_shortage', label: 'Kurang Shift' },
  { key: 'total_late_minutes', label: 'Menit Telat' },
  { key: 'overtime_hours', label: 'Lembur (jam)' }
];

export default async function SdmPage() {
  const ov = await getOverview();
  const mod = ov.modules.hr;
  const kpi = consolidateHr(mod.rows);
  const h = MODULES.hr;
  const updated = formatTimeHm(mod.rows[0]?.created_at ?? '');

  const topLate = [...mod.rows]
    .filter((r) => Number(r.total_late_minutes ?? 0) > 0)
    .sort((a, b) => Number(b.total_late_minutes) - Number(a.total_late_minutes))
    .slice(0, 3);

  return (
    <>
      {ov.mock && <MockBanner forced={ov.mockForced} />}
      <div className='flex items-center justify-between'>
        <h1 className='text-lg font-bold'>SDM — {formatDateShort(ov.date)}</h1>
        <StatusDot status={mod.status} />
      </div>

      {mod.status === 'offline' ? (
        <EmptyState message='Modul SDM tidak bisa dihubungi. Cek /owner/health.' />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
            {([
              ['Hadir / Terjadwal', `${kpi.present}/${kpi.scheduled}`],
              ['Telat', String(kpi.late)],
              ['Absen', String(kpi.absent)],
              ['Cuti', String(kpi.leave)],
              ['Kekurangan shift', String(kpi.shiftShortage)],
              ['Isu payroll', String(kpi.payrollIssues)]
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className='rounded-lg border border-border bg-background p-3'>
                <p className='text-[10px] text-muted-foreground'>{label}</p>
                <p className='text-sm font-bold'>{value}</p>
              </div>
            ))}
          </div>

          {topLate.length > 0 && (
            <Card title='Keterlambatan tertinggi'>
              <ul className='space-y-1 text-xs'>
                {topLate.map((r) => (
                  <li key={r.summary_id} className='flex justify-between'>
                    <span>{r.outlet_name}</span>
                    <span className='font-semibold'>{r.staff_late} orang · {r.total_late_minutes} mnt</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title='Kehadiran per outlet'>
            <FilterableRows rows={mod.rows} columns={COLUMNS} />
            <SourceTag source='Modul SDM (hr_daily_summary)' updatedAt={updated} />
          </Card>

          <Card title='Payroll & detail'>
            <p className='text-xs text-muted-foreground'>
              Status periode payroll dan koreksi absensi dikelola di modul SDM:
            </p>
            <div className='mt-2 flex flex-wrap gap-2 text-xs'>
              <a href={moduleUrl(h, '/hr/payroll')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Payroll ↗</a>
              <a href={moduleUrl(h, '/hr/attendance')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Absensi ↗</a>
              <a href={moduleUrl(h, '/hr/lateness')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Keterlambatan ↗</a>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
