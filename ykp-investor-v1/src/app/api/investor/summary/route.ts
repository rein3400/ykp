import { readTab, TABS } from '@/db/sheets';
import { ok, handler } from '@/lib/http';
import { todayWib } from '@/lib/format';

export const GET = handler(async () => {
  const rows = await readTab<Record<string, string>>(TABS.summary);
  const today = todayWib();
  // Public Hermez endpoint: return ONLY rows for the requested date.
  // Falling back to rows.slice(-10) leaks cross-date investor financials
  // (total_capital, dividend_declared, revenue) to unauthenticated callers.
  const todayRows = rows.filter((r) => r.date === today);
  return ok({ items: todayRows });
});