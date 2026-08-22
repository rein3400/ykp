/**
 * One-time migrator: copy all HR tabs from Google Sheets to Postgres.
 *
 * Idempotent-ish: inserts in __rownum order (stable). Re-running duplicates
 * rows (no upsert), so run once after `npm run sheets:bootstrap` baseline.
 * Usage: USE_POSTGRES=true DATABASE_URL=... tsx scripts/migrate-pg.ts
 *
 * Reads from Sheets (source), writes to Postgres (target). Requires the DDL
 * to already be applied on DATABASE_URL.
 */
import { readTab, TABS, TAB_HEADERS } from '../src/db/sheets';
import { pgAppendRows, isPostgresMode } from '../src/db/postgres';

async function main(): Promise<void> {
  if (!isPostgresMode()) {
    console.error('Set USE_POSTGRES=true and DATABASE_URL first.');
    process.exit(1);
  }
  const names = Object.keys(TABS) as (keyof typeof TABS)[];
  let total = 0;
  for (const key of names) {
    const tab = TABS[key];
    const headers = TAB_HEADERS[tab] ?? [];
    if (headers.length === 0) { console.log(`skip ${tab} (no headers)`); continue; }
    process.stdout.write(`migrate ${tab}... `);
    const rows = await readTab<Record<string, string>>(key as never); // sheets path
    if (rows.length === 0) { console.log('0 rows'); continue; }
    const start = await pgAppendRows(tab, headers, rows);
    total += rows.length;
    console.log(`${rows.length} rows (start __rownum=${start})`);
  }
  console.log(`DONE. total rows migrated: ${total}`);
}

main().catch((e) => {
  console.error('MIGRATION FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
