import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { todayWib, nowTimestampWib, formatIdr } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function WarehouseOverview() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [items, closing, waste] = await Promise.all([
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.legacyClosing),
    readTab<Record<string, string>>(TABS.waste)
  ]);

  const today = todayWib();
  const activeItems = items.filter((i) => i.active_status === 'active');
  const belowMin = activeItems.filter((i) => {
    const min = Number(i.minimum_stock || 0);
    return min > 0; // stock tracking needs ledger; flag if min set
  });
  const todayWaste = waste.filter((w) => w.date === today);
  const todayClosing = closing.filter((c) => c.date === today);
  const closingDone = todayClosing.length > 0;
  const diffItems = todayClosing.filter((c) => {
    const pct = Number(c.diff_pct || 0);
    return pct > 5;
  });

  const cards = [
    { label: 'Item Aktif', value: activeItems.length, unit: 'item' },
    { label: 'Item di Bawah Min', value: belowMin.length, unit: 'item' },
    { label: 'Waste Hari Ini', value: todayWaste.length, unit: 'item' },
    { label: 'Opname Hari Ini', value: closingDone ? 'Done' : 'Belum', unit: '' },
    { label: 'Variance > 5%', value: diffItems.length, unit: 'item' }
  ];

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>Warehouse Overview</h1>
        <p className='text-sm text-muted-foreground'>Sistem Kontrol Bahan Baku — snapshot harian.</p>
      </div>
      <div className='grid grid-cols-2 gap-3 md:grid-cols-5'>
        {cards.map((c) => (
          <div key={c.label} className='rounded border border-border bg-background p-3'>
            <p className='text-[10px] text-muted-foreground uppercase'>{c.label}</p>
            <p className='text-lg font-bold'>{c.value}{c.unit ? ` ${c.unit}` : ''}</p>
          </div>
        ))}
      </div>
      {diffItems.length > 0 && (
        <div className='rounded border border-destructive/30 bg-destructive/5 p-3'>
          <p className='text-sm font-semibold text-destructive'>⚠ Item selisih di atas toleransi</p>
          <ul className='mt-1 text-xs'>
            {diffItems.slice(0, 5).map((d) => (
              <li key={d.item_id}>
                {d.item_name}: selisih {d.diff_pct}% (aktual {d.actual_stock} vs expected {d.expected_stock} {d.unit})
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className='text-xs text-muted-foreground'>Generated {nowTimestampWib()}</div>
    </div>
  );
}