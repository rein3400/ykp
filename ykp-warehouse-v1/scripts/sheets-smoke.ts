/**
 * Sheets smoke test: write a row to warehouse_stock_movement, read it back, report.
 * Validates the core readTab/appendRows/findRow roundtrip on the live spreadsheet.
 */
import { appendRows, findRow, readTab, TABS } from '../src/db/sheets';
import { nowTimestampWib } from '../src/lib/format';

async function main(): Promise<void> {
  const moveId = `MV-SMOKE-${Date.now().toString(36).toUpperCase()}`;
  const row = {
    movement_id: moveId,
    movement_number: moveId,
    movement_datetime: nowTimestampWib(),
    item_id: 'ITM-001',
    brand_id: 'BR-001',
    outlet_id: 'OL-001',
    location_id: 'LOC-002',
    movement_type: 'OPENING_BALANCE',
    direction: 'IN',
    quantity: '5',
    base_unit: 'kg',
    unit_cost: '175000',
    total_value: '875000',
    reference_type: 'smoke_test',
    reference_id: '',
    source_location_id: '',
    destination_location_id: 'LOC-002',
    stock_before: '0',
    stock_after: '5',
    created_by: 'USR-001',
    approved_by: '',
    notes: 'smoke test',
    environment: 'TESTING',
    created_at: nowTimestampWib()
  };
  await appendRows(TABS.stockMovement, [row]);
  const found = await findRow(TABS.stockMovement, 'movement_id', moveId);
  if (!found) throw new Error('smoke test failed: row not found after append');
  const rows = await readTab<typeof row>(TABS.stockMovement);
  const mine = rows.find((r) => r.movement_id === moveId);
  console.log('smoke OK:', mine?.movement_id, mine?.item_id, mine?.stock_after);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});