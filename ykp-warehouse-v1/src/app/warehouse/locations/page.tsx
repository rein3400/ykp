import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import LocationsClient from './locations-client';

export const dynamic = 'force-dynamic';

export default async function LocationsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [locations, brands, outlets] = await Promise.all([
    readTab<Record<string, string>>(TABS.locations),
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.outlets)
  ]);
  const canWrite = session.role === 'owner' || session.role === 'super_admin' || session.role === 'warehouse_admin';
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Master Location</h1>
        <p className='text-sm text-muted-foreground'>Lokasi penyimpanan: gudang pusat, outlet, kitchen, chiller, freezer, dry storage.</p>
      </div>
      <LocationsClient locations={locations} brands={brands} outlets={outlets} canWrite={canWrite} />
    </div>
  );
}
