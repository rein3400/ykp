import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import PurchaseReqClient from './purchase-req-client';

export const dynamic = 'force-dynamic';

export default async function PurchaseReqPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [requests, recommendations] = await Promise.all([
    readTab<Record<string, string>>(TABS.purchaseRequest),
    readTab<Record<string, string>>(TABS.purchaseRecommendation)
  ]);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Purchase Request</h1>
        <p className='text-sm text-muted-foreground'>Ubah recommendation jadi permintaan pembelian. Finance kelola invoice/payment. Brief §11.</p>
      </div>
      <PurchaseReqClient requests={requests} recommendations={recommendations} />
    </div>
  );
}
