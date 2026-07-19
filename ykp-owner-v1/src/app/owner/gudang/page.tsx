/** /owner/gudang — inventory value, critical stock, variance, expiry, purchase recs. */
import { getOverview } from '@/lib/aggregate';
import { consolidateWarehouse } from '@/lib/consolidate';
import { idr, formatDateShort, formatTimeHm } from '@/lib/format';
import { MODULES, moduleUrl } from '@/lib/modules';
import { Card, EmptyState, SourceTag, StatusDot } from '@/components/ui';
import { FilterableRows, type Column } from '@/components/filterable-rows';
import { MockBanner } from '@/components/banners';

export const dynamic = 'force-dynamic';

const COLUMNS: Column[] = [
  { key: 'total_inventory_value', label: 'Nilai Stok', format: 'idr' },
  { key: 'critical_low_stock_count', label: 'Kritis' },
  { key: 'stockout_risk_count', label: 'Risiko Stockout' },
  { key: 'unexplained_variance_value', label: 'Varians Tak Terjelaskan', format: 'idr' },
  { key: 'near_expiry_item_count', label: 'Near Expiry' },
  { key: 'expired_item_count', label: 'Expired' },
  { key: 'waste_value', label: 'Waste', format: 'idr' }
];

export default async function GudangPage() {
  const ov = await getOverview();
  const mod = ov.modules.warehouse;
  const kpi = consolidateWarehouse(mod.rows);
  const w = MODULES.warehouse;
  const updated = formatTimeHm(mod.rows[0]?.generated_at ?? mod.rows[0]?.created_at ?? '');

  return (
    <>
      {ov.mock && <MockBanner forced={ov.mockForced} />}
      <div className='flex items-center justify-between'>
        <h1 className='text-lg font-bold'>Gudang — {formatDateShort(ov.date)}</h1>
        <StatusDot status={mod.status} />
      </div>

      {mod.status === 'offline' ? (
        <EmptyState message='Modul Gudang tidak bisa dihubungi. Cek /owner/health.' />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
            {([
              ['Nilai inventori', idr(kpi.inventoryValue)],
              ['Stok kritis', String(kpi.criticalLowStock)],
              ['Risiko stockout', String(kpi.stockoutRisk)],
              ['Varians tak terjelaskan', idr(kpi.unexplainedVariance)],
              ['Near expiry', String(kpi.nearExpiry)],
              ['Expired', String(kpi.expired)],
              ['Waste hari ini', idr(kpi.wasteValue)],
              ['Est. nilai pembelian', idr(kpi.estimatedPurchaseValue)]
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className='rounded-lg border border-border bg-background p-3'>
                <p className='text-[10px] text-muted-foreground'>{label}</p>
                <p className='text-sm font-bold'>{value}</p>
              </div>
            ))}
          </div>

          <Card title={`Purchase recommendation pending (${mod.purchaseRecs.length})`}>
            {mod.purchaseRecs.length === 0 ? (
              <EmptyState message='Tidak ada purchase recommendation pending.' />
            ) : (
              <ul className='divide-y divide-border text-xs'>
                {mod.purchaseRecs.map((p) => (
                  <li key={p.recommendation_id} className='flex items-start justify-between gap-2 py-2'>
                    <div>
                      <p className='font-medium'>{p.item_name} — {p.recommended_qty} {p.unit}</p>
                      <p className='text-[10px] text-muted-foreground'>{p.reason}</p>
                    </div>
                    <span className='shrink-0 font-semibold'>{idr(Number(p.estimated_cost ?? 0) || 0)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className='mt-2'>
              <a href={moduleUrl(w, '/warehouse/purchase-recommendation')} target='_blank' rel='noopener noreferrer' className='text-xs font-medium text-primary hover:underline'>
                Proses di modul Gudang ↗
              </a>
            </div>
          </Card>

          <Card title='Per outlet'>
            <FilterableRows rows={mod.rows} columns={COLUMNS} />
            <SourceTag source='Modul Gudang (wh_daily_summary)' updatedAt={updated} />
          </Card>

          <Card title='Detail'>
            <div className='flex flex-wrap gap-2 text-xs'>
              <a href={moduleUrl(w, '/warehouse/stok')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Stok ↗</a>
              <a href={moduleUrl(w, '/warehouse/expiry')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Expiry ↗</a>
              <a href={moduleUrl(w, '/warehouse/opname')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Opname / varians ↗</a>
              <a href={moduleUrl(w, '/warehouse/alerts')} target='_blank' rel='noopener noreferrer' className='rounded border border-border px-2 py-1 font-medium hover:bg-muted'>Alerts ↗</a>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
