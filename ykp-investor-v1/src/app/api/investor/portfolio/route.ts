import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { list, unauthorized, handler } from '@/lib/http';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  const rows = await readTab<Record<string, string>>(TABS.shareholding);
  // investor role: only own positions (never other investors' shareholding)
  const filtered = s.role === 'investor' && s.investorId ? rows.filter((r) => r.investor_id === s.investorId) : rows;
  return list(filtered);
});