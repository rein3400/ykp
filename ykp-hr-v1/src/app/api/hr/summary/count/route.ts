/**
 * Public row counts across all Sheets tabs. Used by ykp-hub health check.
 * No PII — just counts per tab.
 */
import { NextResponse } from "next/server";
import { readTab, TABS, TAB_HEADERS } from '@/db/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tabKeys = Object.keys(TABS) as (keyof typeof TABS)[];
  const tabs = await Promise.all(
    tabKeys.map(async (k) => {
      try {
        const rows = await readTab(TABS[k]);
        return { name: TABS[k], columns: TAB_HEADERS[TABS[k]].length, rows: rows.length };
      } catch {
        return { name: TABS[k], columns: 0, rows: 0 };
      }
    })
  );
  const total = tabs.reduce((s, t) => s + t.rows, 0);
  return NextResponse.json({ data: { tabs, total } });
}