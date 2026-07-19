import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ActionsClient from './actions-client';

export const dynamic = 'force-dynamic';

export default async function ActionsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const actions = await readTab<Record<string, string>>(TABS.actionTracker);
  return <ActionsClient actions={actions} role={session.role} />;
}
