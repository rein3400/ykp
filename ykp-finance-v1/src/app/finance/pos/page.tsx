import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import PosClient from './pos-client';

export const dynamic = 'force-dynamic';

export default async function PosPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [brands, outlets, pos, thresholds] = await Promise.all([
    readTab<Record<string, string>>(TABS.brands),
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.posDaily),
    readTab<Record<string, string>>(TABS.thresholdConfig)
  ]);
  return <PosClient brands={brands} outlets={outlets} pos={pos} thresholds={thresholds} />;
}
