import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import CategoriesClient from './categories-client';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const categories = await readTab<Record<string, string>>(TABS.itemCategory);
  const canWrite = session.role === 'owner' || session.role === 'super_admin' || session.role === 'warehouse_admin';
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Master Item Category</h1>
        <p className='text-sm text-muted-foreground'>Kategori item: Protein, Dairy, Dry Goods, dll.</p>
      </div>
      <CategoriesClient categories={categories} canWrite={canWrite} />
    </div>
  );
}
