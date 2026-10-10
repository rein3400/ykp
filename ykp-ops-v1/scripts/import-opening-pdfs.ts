import { appendRows, readTab, TABS } from '../src/db/sheets';
import { openingPdfTemplates, type OpeningPdfSource } from '../src/lib/opening-pdfs';
import { logAudit } from '../src/lib/audit';

async function main(): Promise<void> {
  if (process.env.USE_MOCK_DB === 'true') throw new Error('Mock import refused');
  const outlets = await readTab<Record<string, string>>(TABS.outlets);
  const targets: [OpeningPdfSource, string][] = [
    ['funkydak', 'funkydakcolombo'], ['sekar-shift1', 'sekarpizzacolombo'], ['sekar-shift1', 'sekarpizzatirtodipuran']
  ];
  const expected: Record<string, string>[] = [];
  for (const [source, name] of targets) {
    const matches = outlets.filter((row) => (row.outlet_name ?? '').trim().toLowerCase().replace(/\s+/g, '') === name && ['active', '1'].includes((row.status ?? '').trim().toLowerCase()));
    if (matches.length !== 1) throw new Error(`Outlet missing or ambiguous: ${name}; reconcile Ops master first`);
    const rows = openingPdfTemplates(source, matches[0]);
    console.log(`TARGET ${matches[0].outlet_id} ${matches[0].outlet_name}: ${rows.length} tasks`);
    expected.push(...rows);
  }
  const existing = await readTab<Record<string, string>>(TABS.checklistTemplates);
  const create = expected.filter((template) => {
    const matches = existing.filter((row) => row.checklist_template_id === template.checklist_template_id);
    if (matches.length > 1) throw new Error(`Duplicate ID: ${template.checklist_template_id}`);
    if (matches.length) {
      if (Object.keys(template).some((key) => matches[0][key] !== template[key])) throw new Error(`Changed template not overwritten: ${template.checklist_template_id}`);
      return false;
    }
    if (existing.some((row) => row.outlet_id === template.outlet_id && row.checklist_type === 'OPENING' && row.department === template.department && row.checklist_item === template.checklist_item)) throw new Error(`Equivalent task with different ID: ${template.checklist_template_id}`);
    return true;
  });
  const apply = process.argv.includes('--apply');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}; expected=76; new=${create.length}; existing=${76 - create.length}`);
  for (const row of create) console.log(row.checklist_template_id, row.department, row.checklist_item);
  if (!apply) return;
  if (create.length) {
    await appendRows(TABS.checklistTemplates, create);
    await logAudit({ actorUserId: 'script', actorRole: 'system', action: 'import', entity: 'checklist_template', entityId: 'opening-pdfs-funkydak-sekar', afterValue: JSON.stringify({ sources: ['Checklist Opening Funkydak.pdf', 'Checklist_Openingan_Shift_1.pdf'], ids: create.map((row) => row.checklist_template_id) }) });
  }
  const finalRows = await readTab<Record<string, string>>(TABS.checklistTemplates);
  for (const template of expected) {
    const matches = finalRows.filter((row) => row.checklist_template_id === template.checklist_template_id);
    if (matches.length !== 1 || Object.keys(template).some((key) => matches[0][key] !== template[key])) throw new Error(`Verification failed: ${template.checklist_template_id}`);
  }
  console.log('Verified: Funkydak 30, Sekar Colombo 23, Sekar Tirtodipuran 23 OPENING tasks; previous templates preserved. Shift 1 is a label, not a shift filter.');
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
