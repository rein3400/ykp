/**
 * Alerts ΓÇö list. Public GET for the owner hub / Hermez layer (middleware
 * allowlists GET on /api/ops/alerts*); mutations stay session-protected.
 */
import { readTab, TABS } from '@/db/sheets';
import { list, handler } from '@/lib/http';

export const GET = handler(async () => {
  const rows = await readTab<Record<string, string>>(TABS.alertLog);
  return list(rows);
});
