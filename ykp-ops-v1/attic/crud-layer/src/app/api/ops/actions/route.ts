/**
 * Action tracker ΓÇö list. Public GET for the owner hub / Hermez layer
 * (middleware allowlists GET on /api/ops/actions*); mutations stay
 * session-protected.
 */
import { readTab, TABS } from '@/db/sheets';
import { list, handler } from '@/lib/http';

export const GET = handler(async () => {
  const rows = await readTab<Record<string, string>>(TABS.actionTracker);
  return list(rows);
});
