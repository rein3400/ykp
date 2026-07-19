import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import RingkasanClient from './ringkasan-client';

export const dynamic = 'force-dynamic';

export default async function RingkasanPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [brands, outlets, pos, expenses, suppliers, petty, closing, alerts] = await Promise.all([
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.posDaily),
    readTab<Record<string, string>>(TABS.expense),
    readTab<Record<string, string>>(TABS.supplierCost),
    readTab<Record<string, string>>(TABS.pettyCash),
    readTab<Record<string, string>>(TABS.closingCash),
    readTab<Record<string, string>>(TABS.alertLog)
  ]);
  return (
    <RingkasanClient
      brands={brands}
      outlets={outlets}
      pos={pos}
      expenses={expenses}
      suppliers={suppliers}
      petty={petty}
      closing={closing}
      alerts={alerts}
    />
  );
}
