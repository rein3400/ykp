/**
 * Mirror the OPENING checklist templates into CLOSING templates so the Closing
 * screen ("same as opening checklist") has items to execute.
 *
 * Dry-run by default. Idempotent: deterministic CLOSING ids derived from the
 * OPENING id — re-running never duplicates and never overwrites owner edits.
 *
 *   npm run sheets:clone-closing-templates            # plan only
 *   npm run sheets:clone-closing-templates -- --apply
 */
import { appendRows, findRow, readTab, TABS } from '../src/db/sheets';

async function main(): Promise<void> {
  if (process.env.USE_MOCK_DB === 'true') {
    throw new Error('Refusing to run against the mock backend — pass real Sheets configuration');
  }
  const apply = process.argv.includes('--apply');
  const templates = await readTab<Record<string, string>>(TABS.checklistTemplates);
  const opening = templates.filter((row) => (row.checklist_type ?? '').toUpperCase() === 'OPENING' && (row.active_status ?? '').toLowerCase() !== 'inactive');
  if (!opening.length) throw new Error('No active OPENING templates found — nothing to mirror');

  const plan: Record<string, string>[] = [];
  for (const source of opening) {
    const closingId = `CL-${source.checklist_template_id ?? source.checklist_item}`;
    if (templates.some((row) => row.checklist_template_id === closingId)) continue;
    plan.push({
      checklist_template_id: closingId,
      brand_id: source.brand_id ?? '',
      outlet_id: source.outlet_id ?? '',
      checklist_type: 'CLOSING',
      department: source.department ?? 'Umum',
      checklist_item: source.checklist_item ?? '',
      required_photo: source.required_photo ?? 'false',
      target_value: source.target_value ?? '',
      tolerance_value: source.tolerance_value ?? '',
      critical_flag: source.critical_flag ?? 'false',
      active_status: 'active'
    });
  }
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'} · opening=${opening.length} · to-create=${plan.length}`);
  for (const row of plan) console.log(`  + ${row.checklist_template_id} [${row.department}] ${row.checklist_item}`);
  if (!apply) return;
  for (const row of plan) {
    const existing = await findRow(TABS.checklistTemplates, 'checklist_template_id', row.checklist_template_id);
    if (existing) continue;
    await appendRows(TABS.checklistTemplates, [row]);
  }
  console.log(`Created ${plan.length} CLOSING template(s). Closing screen will now show the same checklist as Opening.`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
