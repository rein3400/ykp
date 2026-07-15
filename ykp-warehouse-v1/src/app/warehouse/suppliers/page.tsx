import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import SuppliersClient from './suppliers-client';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const suppliers = await readTab<Record<string, string>>(TABS.suppliers);
  const canWrite = session.role === 'owner' || session.role === 'super_admin' || session.role === 'warehouse_admin' || session.role === 'purchasing';
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Master Supplier</h1>
        <p className='text-sm text-muted-foreground'>Supplier dengan lead time, minimum order, dan info bank.</p>
      </div>
      <SuppliersClient suppliers={suppliers} canWrite={canWrite} />
    </div>
  );
}
