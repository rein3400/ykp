import { appendRows, findRow, readTab, updateRow, TABS } from '../src/db/sheets';
import { logAudit } from '../src/lib/audit';
import { nowTimestampWib } from '../src/lib/format';

async function main(): Promise<void> {
  if (process.env.USE_MOCK_DB === 'true') throw new Error('Real backend required');
  const oldEmail = 'arrisbudiyatno@gmail.com';
  const newEmail = 'ykp.erp@gmail.com';
  const apply = process.argv.includes('--apply');
  const settings = await readTab<Record<string, string>>(TABS.appSettings);
  const user = settings.find((row) => row.setting_key === 'smtp_user');
  const changedUser = user?.setting_value.trim().toLowerCase() === oldEmail;
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}; sender ${oldEmail} -> ${newEmail}`);
  if (!user || !user.setting_value.trim()) throw new Error('SMTP user is environment-backed or unset; configure the new account and its App Password via HR Email Settings instead');
  if (!changedUser && user.setting_value.trim().toLowerCase() !== newEmail) throw new Error('Unexpected SMTP account; refusing overwrite');
  for (const row of settings) {
    if (row.setting_key !== 'smtp_user' || !changedUser) continue;
    console.log('CHANGE smtp_user; CLEAR smtp_pass (old credential must not be reused)');
    if (apply) {
      const password = await findRow(TABS.appSettings, 'setting_key', 'smtp_pass');
      if (password) await updateRow(TABS.appSettings, password.rowNumber, { ...password.row, setting_value: '', updated_at: nowTimestampWib(), updated_by: 'script' });
      else await appendRows(TABS.appSettings, [{ setting_key: 'smtp_pass', setting_value: '', updated_at: nowTimestampWib(), updated_by: 'script' }]);
      const current = await findRow(TABS.appSettings, 'setting_key', 'smtp_user');
      if (!current || current.row.setting_value !== row.setting_value) throw new Error('SMTP configuration changed; abort');
      await updateRow(TABS.appSettings, current.rowNumber, { ...current.row, setting_value: newEmail, updated_at: nowTimestampWib(), updated_by: 'script' });
      await logAudit({ actorUserId: 'script', actorRole: 'system', action: 'change_sender', entity: 'smtp', entityId: 'smtp_user', beforeValue: oldEmail, afterValue: newEmail });
    }
  }
  const brands = await readTab<Record<string, string>>(TABS.brands);
  for (const brand of brands) {
    if ((brand.email ?? '').trim().toLowerCase() !== oldEmail) continue;
    console.log('CHANGE brand sender', brand.brand_id);
    if (apply) {
      const found = await findRow(TABS.brands, 'brand_id', brand.brand_id);
      if (!found || found.row.email !== brand.email) throw new Error('Brand changed; abort');
      await updateRow(TABS.brands, found.rowNumber, { ...found.row, email: newEmail });
      await logAudit({ actorUserId: 'script', actorRole: 'system', action: 'change_sender', entity: 'brand', entityId: brand.brand_id, beforeValue: oldEmail, afterValue: newEmail });
    }
  }
  console.log('Employee recipient addresses and historical audit rows are unchanged. Configure the NEW account App Password in HR Email Settings; environment SMTP_PASS must also be replaced, not reused.');
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
