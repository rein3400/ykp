/**
 * Clear DUMMY master items & suppliers (client: "dikosongin aja krn mau dicoba sekalian").
 *
 * Safety: dry-run by default; refuses mock backend; writes a backup JSON before
 * any delete; blocks any master still referenced by operational records
 * (receiving/issue/transfer/stock-count/batch/movement/waste/adjustment/
 * unit-conversion/purchase + item↔supplier links) and reports them instead.
 *
 *   npm run sheets:purge-dummy-masters            # plan only
 *   npm run sheets:purge-dummy-masters -- --apply
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { appendRows, deleteRow, findRow, readTab, TABS } from '../src/db/sheets';
import { planMasterPurge } from '../src/lib/master-purge';
import { nowTimestampWib } from '../src/lib/format';

interface Row { rowNumber: number; row: Record<string, string> }

async function collectRefs(): Promise<{ refs: Record<string, string[]>; source: Row[] }> {
  const add = (refs: Record<string, string[]>, id: string | undefined, domain: string) => {
    if (!id) return;
    (refs[id] ??= []).push(domain);
  };
  const refs: Record<string, string[]> = {};
  const detailTabs = [
    TABS.receivingItem, TABS.stockIssueItem, TABS.transferItem, TABS.stockCountItem,
    TABS.batchStock, TABS.stockMovement, TABS.waste, TABS.adjustment,
    TABS.unitConversion, TABS.purchaseRequestItem, TABS.purchaseRecommendation
  ] as const;
  for (const tab of detailTabs) {
    for (const row of await readTab<Record<string, string>>(tab)) add(refs, row.item_id, tab);
  }
  // Item → supplier links block supplier deletion.
  const items = await readTab<Record<string, string>>(TABS.items);
  for (const item of items) {
    add(refs, item.preferred_supplier_id, 'item:preferred_supplier');
    add(refs, item.backup_supplier_id, 'item:backup_supplier');
  }
  for (const req of await readTab<Record<string, string>>(TABS.purchaseRequest)) add(refs, req.supplier_id, TABS.purchaseRequest);
  for (const recv of await readTab<Record<string, string>>(TABS.receiving)) add(refs, recv.supplier_id, TABS.receiving);
  return { refs, source: [] };
}

async function main(): Promise<void> {
  if (process.env.USE_MOCK_DB === 'true') throw new Error('Refusing to purge with the mock backend — pass real Sheets configuration');
  const apply = process.argv.includes('--apply');
  const [items, suppliers, { refs }] = await Promise.all([
    readTab<Record<string, string>>(TABS.items),
    readTab<Record<string, string>>(TABS.suppliers),
    collectRefs()
  ]);
  const plan = planMasterPurge(items, suppliers, refs);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'} · items=${items.length} → delete ${plan.deletableItems.length} / blocked ${plan.blockedItems.length}`);
  console.log(`· suppliers=${suppliers.length} → delete ${plan.deletableSuppliers.length} / blocked ${plan.blockedSuppliers.length}`);
  for (const b of plan.blockedItems) console.log(`  BLOCKED item ${b.id}: ${b.domains.join(', ')}`);
  for (const b of plan.blockedSuppliers) console.log(`  BLOCKED supplier ${b.id}: ${b.domains.join(', ')}`);
  for (const i of plan.deletableItems) console.log(`  DELETE item ${i.item_id} ${i.item_name ?? ''}`);
  for (const s of plan.deletableSuppliers) console.log(`  DELETE supplier ${s.supplier_id} ${s.supplier_name ?? ''}`);
  if (!apply) return;
  if (!plan.deletableItems.length && !plan.deletableSuppliers.length) { console.log('Nothing to delete.'); return; }

  const stamp = nowTimestampWib().replace(/[: ]/g, '-');
  mkdirSync('.data', { recursive: true });
  const backup = `.data/purge-masters-backup-${stamp}.json`;
  writeFileSync(backup, JSON.stringify({ items: plan.deletableItems, suppliers: plan.deletableSuppliers }, null, 2));
  console.log(`Backup written: ${backup}`);

  // Delete from the bottom up so earlier row numbers stay valid.
  const targets: Array<{ tab: typeof TABS.items | typeof TABS.suppliers; key: string; id: string }> = [
    ...plan.deletableItems.map((i) => ({ tab: TABS.items as typeof TABS.items, key: 'item_id', id: i.item_id })),
    ...plan.deletableSuppliers.map((s) => ({ tab: TABS.suppliers as typeof TABS.suppliers, key: 'supplier_id', id: s.supplier_id }))
  ];
  const located = (await Promise.all(targets.map(async (t) => ({ ...t, found: await findRow(t.tab, t.key, t.id) }))))
    .filter((t) => t.found).sort((a, b) => b.found!.rowNumber - a.found!.rowNumber);
  for (const t of located) {
    await deleteRow(t.tab, t.found!.rowNumber);
    await appendRows(TABS.auditLog, [{
      audit_id: `PURGE-${t.id}`, timestamp: nowTimestampWib(), actor_user_id: 'script', actor_role: 'system',
      action: 'purge_dummy_master', entity: t.tab, entity_id: t.id, before_value: JSON.stringify(t.found!.row), after_value: 'DELETED'
    }]);
  }
  const remainingItems = (await readTab<Record<string, string>>(TABS.items)).length;
  const remainingSuppliers = (await readTab<Record<string, string>>(TABS.suppliers)).length;
  console.log(`Done. Remaining items=${remainingItems}, suppliers=${remainingSuppliers} (blocked records intentionally kept).`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
