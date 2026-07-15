/**
 * Sheets smoke test: write+read a row to investor_daily_summary.
 */
import { appendRows, findRow, readTab, TABS } from '../src/db/sheets';
import { todayWib, nowTimestampWib } from '../src/lib/format';
import { nextSequentialIdSync } from '../src/lib/repo';

async function main(): Promise<void> {
  const id = nextSequentialIdSync('SMK');
  const row = {
    summary_id: id, date: todayWib(), total_revenue: '0', total_profit: '0',
    total_capital: '0', active_investors: '0', dividend_declared: '0',
    growth_pct: '0', created_at: nowTimestampWib()
  };
  await appendRows(TABS.summary, [row]);
  const found = await findRow(TABS.summary, 'summary_id', id);
  if (!found) throw new Error('smoke failed: row not found');
  const rows = await readTab<typeof row>(TABS.summary);
  const mine = rows.find((r) => r.summary_id === id);
  console.log('smoke OK:', mine?.summary_id);
}

main().catch((e) => { console.error(e); process.exit(1); });