/** /owner/operasional — outlet readiness, checklist, incidents, cash difference. */
import { getOverview } from '@/lib/aggregate';
import { consolidateOps } from '@/lib/consolidate';
import { idr, formatDateShort, formatTimeHm } from '@/lib/format';
import { MODULES, moduleUrl } from '@/lib/modules';
import { Card, EmptyState, SourceTag, StatusDot } from '@/components/ui';
import { FilterableRows, type Column } from '@/components/filterable-rows';
import { MockBanner } from '@/components/banners';

export const dynamic = 'force-dynamic';

const COLUMNS: Column[] = [
  { key: 'opening_status', label: 'Opening' },
  { key: 'opening_completion_percentage', label: 'Checklist %' },
  { key: 'incident_count', label: 'Insiden' },
  { key: 'high_severity_incident', label: 'Insiden Berat' },
  { key: 'complaint_count', label: 'Komplain' },
  { key: 'closing_status', label: 'Closing' },
  { key: 'cash_difference', label: 'Selisih Kas', format: 'idr' }
];

export default async function OperasionalPage() {
  const ov = await getOverview();
  const mod = ov.modules.ops;
  const kpi = consolidateOps(mod.rows);
  const o = MODULES.ops;
  const updated = formatTimeHm(mod.rows[0]?.created_at ?? '');

  return (
    <>
      {ov.mock && <MockBanner forced={ov.mockForced} />}
      <div className='flex items-center justify-between'>
        <h1 className='text-lg font-bold'>Operasional — {formatDateShort(ov.date)}</h1>
        <StatusDot status={mod.status} />
      </div>

      {mod.status === 'offline' ? (
        <EmptyState message='Modul Operasional tidak bisa dihubungi. Cek /owner/health.' />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
            {([
              ['Outlet siap', `${kpi.outletsReady}/${kpi.outletsTotal}`],
              ['Checklist rata-rata', `${kpi.avgChecklist}%`],
              ['Insiden (berat)', `${kpi.openIncidents} (${kpi.highSeverityIncidents})`],
              ['Selisih kas total', idr(kpi.cashDifference)],
              ['Action terbuka', String(kpi.openActions)]
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className='rounded-lg border border-border bg-background p-3'>
                <p className='text-[10px] text-muted-foreground'>{label}</p>
                <p className='text-sm font-bold'>{value}</p>
              </div>
            ))}
          </div>

          <Card title='Per outlet'>
            <FilterableRows rows={mod.rows} columns={COLUMNS} />
            <SourceTag source='Modul Operasional (ops_daily_summary)' updatedAt={updated} />
          </Card>

          <Card title='Detail'>
            <div className='flex flex-wrap gap-2 text-xs'>
              <a href={moduleUrl(o, '/ops/incidents')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Insiden ↗</a>
              <a href={moduleUrl(o, '/ops/opening')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Opening checklist ↗</a>
              <a href={moduleUrl(o, '/ops/closing')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Closing ↗</a>
              <a href={moduleUrl(o, '/ops/actions')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Actions ↗</a>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
