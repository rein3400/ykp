import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import SettingsClient from './settings-client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const [thresholds, templates, incidentTypes, outlets] = await Promise.all([
    readTab<Record<string, string>>(TABS.thresholdConfig),
    readTab<Record<string, string>>(TABS.checklistTemplate),
    readTab<Record<string, string>>(TABS.incidentType),
    readTab<Record<string, string>>(TABS.outlets)
  ]);
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Settings & Configurations</h1>
        <p className='text-sm text-muted-foreground'>
          Threshold operasional, checklist template master, dan incident types.
        </p>
      </div>
      <SettingsClient
        thresholds={thresholds}
        templates={templates}
        incidentTypes={incidentTypes}
        outlets={outlets.filter((o) => o.status === 'active')}
        role={session.role}
      />
    </div>
  );
}
