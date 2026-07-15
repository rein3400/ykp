import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import PurchaseRecClient from './purchase-rec-client';

export const dynamic = 'force-dynamic';

export default async function PurchaseRecPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const recommendations = await readTab<Record<string, string>>(TABS.purchaseRecommendation);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Purchase Recommendation</h1>
        <p className='text-sm text-muted-foreground'>Reorder point, days of cover, suggested purchase. Brief §10.</p>
      </div>
      <PurchaseRecClient recommendations={recommendations} />
    </div>
  );
}
