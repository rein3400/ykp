import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import SummaryClient from './summary-client';

export const dynamic = 'force-dynamic';

export default async function SummaryPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [summaries, outlets, alerts] = await Promise.all([
    readTab<Record<string, string>>(TABS.dailySummary),
    readTab<Record<string, string>>(TABS.outlets),
    readTab<Record<string, string>>(TABS.alertLog)
  ]);
  return <SummaryClient summaries={summaries} outlets={outlets} alerts={alerts} role={session.role} />;
}
