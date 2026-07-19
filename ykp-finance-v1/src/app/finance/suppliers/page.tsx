import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import SuppliersClient from './suppliers-client';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [brands, outlets, suppliers, costs, pettyAccounts] = await Promise.all([
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.suppliers),
    readTab<Record<string, string>>(TABS.supplierCost),
    readTab<Record<string, string>>(TABS.pettyCashAccounts)
  ]);
  return (
    <SuppliersClient
      brands={brands}
      outlets={outlets}
      suppliers={suppliers}
      costs={costs}
      pettyAccounts={pettyAccounts}
      role={session.role}
    />
  );
}
