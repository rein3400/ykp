import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import PettyClient from './petty-client';

export const dynamic = 'force-dynamic';

export default async function PettyCashPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [brands, outlets, accounts, petty] = await Promise.all([
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.pettyCashAccounts),
    readTab<Record<string, string>>(TABS.pettyCash)
  ]);
  return <PettyClient brands={brands} outlets={outlets} accounts={accounts} petty={petty} role={session.role} />;
}
