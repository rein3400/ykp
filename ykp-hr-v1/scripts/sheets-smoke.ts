/**
 * Smoke: write one row, read it back, delete it.
 *   npm run sheets:smoke
 */
import { appendRows, readTab, TABS } from '../src/db/sheets';
import { nowTimestampWib } from '../src/lib/format';

const TEST_ID = `OUT-SMOKE-${Date.now()}`;

async function main(): Promise<void> {
  const tab = TABS.outlets;
  const row = {
    outlet_id: TEST_ID,
    brand_id: 'BR-001',
    outlet_name: 'Smoke Test Outlet',
    outlet_code: 'SMOKE',
    address: '',
    latitude: '',
    longitude: '',
    attendance_radius_m: '100',
    status: 'pilot',
    created_at: nowTimestampWib(),
    updated_at: nowTimestampWib()
  };
  console.log('[smoke] append', row.outlet_id);
  await appendRows(tab, [row]);
  const rows = await readTab<{ outlet_id: string; outlet_name: string }>(tab);
  const found = rows.find((r) => r.outlet_id === TEST_ID);
  if (!found) {
    console.error('[smoke] FAIL: row not found after append');
    process.exit(1);
  }
  console.log('[smoke] readback ok:', found.outlet_id, found.outlet_name);
  console.log('[smoke] PASS (note: did not delete the row; clean manually)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
