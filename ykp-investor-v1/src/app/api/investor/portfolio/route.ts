import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { list, unauthorized, handler } from '@/lib/http';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const rows = await readTab<Record<string, string>>(TABS.shareholding);
  return list(rows);
});