import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import SettingsClient from './settings-client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [brands, outlets, suppliers, categories, methods, accounts, thresholds] = await Promise.all([
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.suppliers),
    readTab<Record<string, string>>(TABS.expenseCategories),
    readTab<Record<string, string>>(TABS.paymentMethods),
    readTab<Record<string, string>>(TABS.pettyCashAccounts),
    readTab<Record<string, string>>(TABS.thresholdConfig)
  ]);
  return (
    <SettingsClient
      brands={brands}
      outlets={outlets}
      suppliers={suppliers}
      categories={categories}
      methods={methods}
      accounts={accounts}
      thresholds={thresholds}
      role={session.role}
    />
  );
}
