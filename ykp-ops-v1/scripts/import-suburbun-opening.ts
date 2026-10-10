import { appendRows, readTab, TABS } from '../src/db/sheets';
import { suburbunOpeningTemplates } from '../src/lib/suburbun-opening';
import { logAudit } from '../src/lib/audit';

async function main(): Promise<void> {
  if (process.env.USE_MOCK_DB === 'true') throw new Error('Real backend required; mock import refused');
  const idArg = process.argv.find((arg) => arg.startsWith('--outlet-id='));
  const outletId = idArg?.slice('--outlet-id='.length);
  const outlets = await readTab<Record<string, string>>(TABS.outlets);
  const candidates = outlets.filter((row) => /^suburbuns?(?:\s+colombo)?$/i.test((row.outlet_name ?? '').trim()) && (!outletId || row.outlet_id === outletId) && ['active', '1'].includes((row.status ?? '').trim().toLowerCase()));
  if (candidates.length !== 1) throw new Error('Suburbun outlet missing or ambiguous; confirm active Ops master outlet and pass --outlet-id=ID');
  const expected = suburbunOpeningTemplates(candidates[0]);
  const existing = await readTab<Record<string, string>>(TABS.checklistTemplates);
  const create: Record<string, string>[] = [];
  for (const template of expected) {
    const matches = existing.filter((row) => row.checklist_template_id === template.checklist_template_id);
    if (matches.length > 1) throw new Error(`Duplicate template ID: ${template.checklist_template_id}`);
    if (matches.length) {
      if (Object.keys(template).some((key) => matches[0][key] !== template[key])) throw new Error(`Existing template differs; not overwritten: ${template.checklist_template_id}`);
      continue;
    }
    if (existing.some((row) => row.outlet_id === template.outlet_id && row.checklist_type === 'OPENING' && row.checklist_item === template.checklist_item)) throw new Error(`Equivalent task already exists with another ID: ${template.checklist_item}`);
    create.push(template);
  }
  const apply = process.argv.includes('--apply');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}; outlet=${candidates[0].outlet_id} ${candidates[0].outlet_name}; PDF tasks=25; new=${create.length}; existing=${25 - create.length}`);
  for (const row of create) console.log(row.checklist_template_id, row.department, row.checklist_item);
  if (!apply) return;
  if (create.length) {
    await appendRows(TABS.checklistTemplates, create);
    await logAudit({ actorUserId: 'script', actorRole: 'system', action: 'import', entity: 'checklist_template', entityId: candidates[0].outlet_id, afterValue: JSON.stringify({ source: 'Ceklist Opening Suburbuns.pdf', ids: create.map((row) => row.checklist_template_id) }) });
  }
  const finalRows = await readTab<Record<string, string>>(TABS.checklistTemplates);
  for (const template of expected) {
    const matches = finalRows.filter((row) => row.checklist_template_id === template.checklist_template_id);
    if (matches.length !== 1 || Object.keys(template).some((key) => matches[0][key] !== template[key])) throw new Error(`Verification failed: ${template.checklist_template_id}`);
  }
  console.log('Verified: 25 Suburbun PDF OPENING tasks; other templates unchanged.');
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
