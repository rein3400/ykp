import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import UnitConversionClient from './unit-conversion-client';

export const dynamic = 'force-dynamic';

export default async function UnitConversionPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [conversions, items] = await Promise.all([
    readTab<Record<string, string>>(TABS.unitConversion),
    readTab<Record<string, string>>(TABS.items)
  ]);
  const canWrite = session.role === 'owner' || session.role === 'super_admin' || session.role === 'warehouse_admin';
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Unit Conversion</h1>
        <p className='text-sm text-muted-foreground'>Konversi antar satuan: 1 carton = 10 kg, 1 kg = 1000 gram, dll.</p>
      </div>
      <UnitConversionClient conversions={conversions} items={items} canWrite={canWrite} />
    </div>
  );
}
