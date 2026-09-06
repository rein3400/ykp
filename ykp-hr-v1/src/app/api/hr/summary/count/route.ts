/**
 * Public row counts across all HR tabs. Used by ykp-hub health check.
 * No PII — just counts per tab.
 *
 * Truthful health contract (HR incident 2026-09-06):
 * - Healthy (every tab readable): HTTP 200 +
 *   `{ data: { tabs, total }, status: 'ok' }`.
 *   `data.tabs` / `data.total` keep the exact legacy shape.
 * - Degraded (any tab unreadable): HTTP 503 +
 *   `{ data: { tabs, total }, status: 'degraded', failed: [<tab names>] }`.
 *   Tabs that read fine keep their real counts (never blanked). Failed tabs
 *   keep their contracted `columns` count (never 0, which would masquerade as
 *   a healthy empty table) and report `rows: 0` meaning "unknown — see
 *   failed[]", with `total` then a partial sum over readable tabs.
 *   Only tab identifiers are exposed; raw DB errors are logged server-side
 *   in sanitized form (tab name only) and never sent to the client.
 */
import { NextResponse } from "next/server";
import { readTab, TABS, TAB_HEADERS } from '@/db/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tabKeys = Object.keys(TABS) as (keyof typeof TABS)[];
  const settled = await Promise.all(
    tabKeys.map(async (k) => {
      const name = TABS[k];
      const columns = TAB_HEADERS[name]?.length ?? 0;
      try {
        const rows = await readTab(name);
        return { entry: { name, columns, rows: rows.length }, ok: true as const };
      } catch {
        // Sanitized server log only: no error detail (may carry column names,
        // connection info, or PII) — the client gets the tab name via failed[].
        console.error(`[hr-count] readTab failed for tab: ${name}`);
        return { entry: { name, columns, rows: 0 }, ok: false as const };
      }
    })
  );
  const tabs = settled.map((s) => s.entry);
  const failed = tabKeys.filter((_, i) => !settled[i].ok).map((k) => TABS[k]);
  const total = tabs.reduce((s, t) => s + t.rows, 0);
  if (failed.length === 0) {
    return NextResponse.json({ data: { tabs, total }, status: 'ok' });
  }
  return NextResponse.json(
    { data: { tabs, total }, status: 'degraded', failed },
    { status: 503 }
  );
}
