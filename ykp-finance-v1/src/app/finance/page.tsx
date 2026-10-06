import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import RingkasanClient from './ringkasan-client';
import { activeOutlets, operationalRows } from '@/lib/operational-data';

export const dynamic = 'force-dynamic';

export default async function RingkasanPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [brands, outlets, pos, posItems, expenses, suppliers, petty, closing, alerts] = await Promise.all([
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.posDaily),
    readTab<Record<string, string>>(TABS.posItems),
    readTab<Record<string, string>>(TABS.expense),
    readTab<Record<string, string>>(TABS.supplierCost),
    readTab<Record<string, string>>(TABS.pettyCash),
    readTab<Record<string, string>>(TABS.closingCash),
    readTab<Record<string, string>>(TABS.alertLog)
  ]);
  return (
    <RingkasanClient
      brands={brands}
      outlets={activeOutlets(outlets)}
      pos={operationalRows(pos, outlets)}
      items={operationalRows(posItems, outlets)}
      expenses={operationalRows(expenses, outlets)}
      suppliers={suppliers}
      petty={operationalRows(petty, outlets)}
      closing={operationalRows(closing, outlets)}
      alerts={operationalRows(alerts, outlets)}
    />
  );
}
