import { readTab, TABS } from '@/db/sheets';
import { ok, handler } from '@/lib/http';
import { todayWib } from '@/lib/format';

export const GET = handler(async () => {
  const rows = await readTab<Record<string, string>>(TABS.summary);
  const today = todayWib();
  const todayRows = rows.filter((r) => r.date === today);
  return ok({ items: todayRows.length ? todayRows : rows.slice(-10) });
});