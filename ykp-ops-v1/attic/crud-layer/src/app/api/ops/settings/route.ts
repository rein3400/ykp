/**
 * Settings ΓÇö combined read for the settings page.
 */
import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, handler } from '@/lib/http';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const [thresholds, templates, incidentTypes] = await Promise.all([
    readTab<Record<string, string>>(TABS.thresholdConfig),
    readTab<Record<string, string>>(TABS.checklistTemplate),
    readTab<Record<string, string>>(TABS.incidentType)
  ]);
  return ok({ thresholds, templates, incident_types: incidentTypes });
});
