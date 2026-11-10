import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ItemsClient from './items-client';
import { MasterActions } from '@/components/master-actions';
import { can, type Role } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export default async function ItemsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [items, categories, suppliers] = await Promise.all([
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.itemCategory),
    readTab<Record<string, string>>(TABS.suppliers)
  ]);
  const canWrite = session.role === 'owner' || session.role === 'super_admin' || session.role === 'warehouse_admin';
  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Master Item</h1>
          <p className='text-sm text-muted-foreground'>32 kolom per brief §8.1 — item_type, unit, supplier, stok, lead time, expiry, criticality.</p>
        </div>
      </div>
      <MasterActions kind='items' rows={items} canEdit={can(session.role as Role, 'update', 'item')} canArchive={can(session.role as Role, 'delete', 'item')} />
      <ItemsClient items={items} categories={categories} suppliers={suppliers} canWrite={canWrite} />
    </div>
  );
}
