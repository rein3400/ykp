/**
 * App settings (app_settings tab). GET returns all settings; POST upserts
 * a setting by key. Owner/super_admin/finance_admin only (telegram resource).
 */
import { NextRequest } from 'next/server';
import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { ok, unauthorized, badRequest, handler, forbidden } from '@/lib/http';
import { logAudit } from '@/lib/audit';
import { getSetting, setSetting, SETTING_OWNER_CHAT_ID } from '@/lib/settings';
import { can, type Role } from '@/lib/rbac';

export const GET = handler(async () => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'view', 'telegram')) return forbidden('Forbidden');
  const rows = await readTab<Record<string, string>>(TABS.appSettings);
  return ok({ settings: rows, ownerChatId: await getSetting(SETTING_OWNER_CHAT_ID) });
});

export const POST = handler(async (req: NextRequest) => {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!can(s.role as Role, 'update', 'telegram')) return forbidden('Forbidden');

  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const key = (body.key ?? '').trim();
  if (!key) return badRequest('key is required');
  if (!/^[a-z0-9_]+$/.test(key)) return badRequest('key must be lowercase letters, digits, underscore');

  const value = (body.value ?? '').trim();
  const description = (body.description ?? '').trim();
  // Bug #13: telegram_owner_chat_id controls where daily briefs + HIGH/CRITICAL
  // alert pushes are delivered. Restrict changes to it to owner/super_admin so a
  // finance_admin cannot repoint alerts to an attacker channel.
  if (key === SETTING_OWNER_CHAT_ID && s.role !== 'owner' && s.role !== 'super_admin') {
    return forbidden('telegram_owner_chat_id hanya boleh diubah oleh owner / super_admin');
  }
  const before = await getSetting(key);
  await setSetting(key, value, description, s.userId);
  await logAudit({
    module: 'finance', action: 'update', recordType: 'app_settings',
    recordId: key, beforeValue: before, afterValue: value, userId: s.userId
  }).catch(() => null);
  return ok({ key, value });
});
