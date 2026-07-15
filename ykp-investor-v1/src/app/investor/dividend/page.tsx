import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { formatIdr } from '@/lib/format';
import DividendClient from './dividend-client';

export const dynamic = 'force-dynamic';

export default async function DividendPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [rows, investors] = await Promise.all([
    readTab<Record<string, string>>(TABS.dividend),
    readTab<Record<string, string>>(TABS.investors)
  ]);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Dividend</h1>
        <p className='text-sm text-muted-foreground'>Deklarasi & pembayaran dividen. Owner only untuk input.</p>
      </div>
      <DividendClient rows={rows} investors={investors} isOwner={session.role === 'owner'} />
    </div>
  );
}