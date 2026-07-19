/**
 * Sheets smoke test: write a row to fin_pos_daily, read it back, report.
 * Validates the readTab/appendRows/findRow roundtrip on the live spreadsheet.
 */
import { appendRows, findRow, readTab, TABS } from '../src/db/sheets';
import { nowTimestampWib, todayWib } from '../src/lib/format';

async function main(): Promise<void> {
  const posId = `POS-SMOKE-${Date.now().toString(36).toUpperCase()}`;
  const t = nowTimestampWib();
  const row = {
    pos_id: posId,
    date: todayWib(),
    brand_id: 'BR-001',
    brand_name: 'Funkydak',
    outlet_id: 'OL-001',
    outlet_name: 'Funkydak Cipete',
    gross_sales: '100000',
    net_sales: '100000',
    discount: '0',
    refund: '0',
    void: '0',
    tax: '0',
    service_charge: '0',
    settle_cash: '100000',
    settle_qris: '0',
    settle_card: '0',
    settle_transfer: '0',
    settle_marketplace: '0',
    total_settlement: '100000',
    settlement_difference: '0',
    transaction_count: '1',
    aov: '100000',
    cashier: 'smoke',
    shift: '',
    payment_method: 'Cash',
    source: 'manual',
    source_ref: '',
    notes: 'smoke test',
    source_module: 'pos',
    source_transaction_id: '',
    payment_source: '',
    linked_expense_id: '',
    linked_supplier_invoice_id: '',
    linked_petty_cash_id: '',
    created_by: 'USR-001',
    created_at: t,
    updated_at: t
  };
  await appendRows(TABS.posDaily, [row]);
  const found = await findRow(TABS.posDaily, 'pos_id', posId);
  if (!found) throw new Error('smoke test failed: row not found after append');
  const rows = await readTab<typeof row>(TABS.posDaily);
  const mine = rows.find((r) => r.pos_id === posId);
  console.log('smoke OK:', mine?.pos_id, mine?.outlet_id, mine?.net_sales, mine?.settlement_difference);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
