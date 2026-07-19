/**
 * /owner — Command home. Module tile row, headline strip, alert inbox,
 * action tracker. Server component; data via the aggregate lib.
 */
import type { OwnerOverview } from '@/lib/types';
import { getOverview } from '@/lib/aggregate';
import { consolidateFinance, consolidateHr, consolidateOps, consolidateWarehouse } from '@/lib/consolidate';
import { idr, formatDateShort, formatTimeHm } from '@/lib/format';
import { ModuleTile, type TileKpi } from '@/components/module-tile';
import { AlertInbox } from '@/components/alert-inbox';
import { ActionTracker } from '@/components/action-tracker';
import { MockBanner, DegradedBanner } from '@/components/banners';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

function tileKpis(ov: OwnerOverview): Record<string, TileKpi[]> {
  const fin = consolidateFinance(ov.modules.finance.rows);
  const hr = consolidateHr(ov.modules.hr.rows);
  const wh = consolidateWarehouse(ov.modules.warehouse.rows);
  const ops = consolidateOps(ov.modules.ops.rows);
  const inv = ov.modules.investor.rows[0];
  return {
    finance: [
      { label: 'Revenue hari ini', value: idr(fin.revenue) },
      { label: 'Estimasi Surplus Kas', value: idr(fin.estimasiSurplus) },
      { label: 'Unpaid supplier', value: idr(fin.unpaidSupplier) }
    ],
    hr: [
      { label: 'Hadir / Terjadwal', value: `${hr.present}/${hr.scheduled}` },
      { label: 'Telat', value: String(hr.late) },
      { label: 'Absen', value: String(hr.absent) }
    ],
    warehouse: [
      { label: 'Nilai inventori', value: idr(wh.inventoryValue) },
      { label: 'Stok kritis', value: String(wh.criticalLowStock) },
      { label: 'Near expiry', value: String(wh.nearExpiry) }
    ],
    ops: [
      { label: 'Outlet siap', value: `${ops.outletsReady}/${ops.outletsTotal}` },
      { label: 'Checklist', value: `${ops.avgChecklist}%` },
      { label: 'Insiden berat', value: String(ops.highSeverityIncidents) }
    ],
    investor: [
      { label: 'Total revenue', value: idr(Number(inv?.total_revenue ?? 0) || 0) },
      { label: 'Total profit', value: idr(Number(inv?.total_profit ?? 0) || 0) },
      { label: 'Dividend declared', value: idr(Number(inv?.dividend_declared ?? 0) || 0) }
    ]
  };
}

export default async function OwnerHome() {
  const ov = await getOverview();
  const kpis = tileKpis(ov);
  const h = ov.headline;
  const offline = Object.values(ov.modules).filter((m) => m.status === 'offline').map((m) => m.label);
  const revDelta = h.revenue7dAvg && h.revenue7dAvg > 0
    ? Math.round(((h.revenueToday - h.revenue7dAvg) / h.revenue7dAvg) * 100)
    : null;

  return (
    <>
      {ov.mock ? <MockBanner forced={ov.mockForced} /> : <DegradedBanner offline={offline} />}

      <div className='flex items-baseline justify-between'>
        <h1 className='text-lg font-bold'>Command Center</h1>
        <p className='text-[11px] text-muted-foreground'>
          {formatDateShort(ov.date)} · digenerate {formatTimeHm(ov.generatedAt.replace('T', ' '))}
        </p>
      </div>

      {/* Headline strip */}
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5'>
        <div className='rounded-lg border border-border bg-background p-3'>
          <p className='text-[10px] text-muted-foreground'>Estimasi Surplus Kas</p>
          <p className='text-base font-bold'>{idr(h.estimasiSurplusKas)}</p>
        </div>
        <div className='rounded-lg border border-border bg-background p-3'>
          <p className='text-[10px] text-muted-foreground'>Revenue vs rata-rata 7 hari</p>
          <p className='text-base font-bold'>
            {idr(h.revenueToday)}
            {revDelta !== null && (
              <span className={`ml-1 text-[11px] font-semibold ${revDelta >= 0 ? 'text-success' : 'text-destructive'}`}>
                {revDelta >= 0 ? '+' : ''}{revDelta}%
              </span>
            )}
          </p>
        </div>
        <div className='rounded-lg border border-border bg-background p-3'>
          <p className='text-[10px] text-muted-foreground'>Staf hadir / telat</p>
          <p className='text-base font-bold'>{h.staffPresent} / {h.staffLate}</p>
        </div>
        <div className='rounded-lg border border-border bg-background p-3'>
          <p className='text-[10px] text-muted-foreground'>Stok kritis</p>
          <p className={`text-base font-bold ${h.criticalStockCount > 0 ? 'text-destructive' : ''}`}>
            {h.criticalStockCount} item
          </p>
        </div>
        <div className='rounded-lg border border-border bg-background p-3'>
          <p className='text-[10px] text-muted-foreground'>Insiden HIGH/CRITICAL</p>
          <p className={`text-base font-bold ${h.openHighCriticalIncidents > 0 ? 'text-destructive' : ''}`}>
            {h.openHighCriticalIncidents}
          </p>
        </div>
      </div>

      {/* Module tile row */}
      <Card title='Modul'>
        <div className='flex gap-3 overflow-x-auto pb-1'>
          {(['finance', 'hr', 'warehouse', 'ops', 'investor'] as const).map((k) => (
            <ModuleTile
              key={k}
              mod={ov.modules[k]}
              kpis={kpis[k]}
              href={`/owner/${k === 'hr' ? 'sdm' : k === 'warehouse' ? 'gudang' : k === 'ops' ? 'operasional' : k === 'finance' ? 'keuangan' : 'investor'}`}
            />
          ))}
        </div>
      </Card>

      <div className='grid gap-4 lg:grid-cols-2'>
        <AlertInbox alerts={ov.alerts} />
        <ActionTracker actions={ov.actions} />
      </div>
    </>
  );
}
