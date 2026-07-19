import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ClosingClient from './closing-client';

export const dynamic = 'force-dynamic';

export default async function ClosingCashPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [brands, outlets, closing] = await Promise.all([
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.closingCash)
  ]);
  return <ClosingClient brands={brands} outlets={outlets} closing={closing} />;
}
