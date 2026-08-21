/**
 * App settings stored in the app_settings tab (key/value). Used for
 * owner-facing config that must be editable from the UI without touching
 * .env — e.g. the Telegram owner chat id for daily briefs and alert pushes.
 */
import { readTab, appendRows, updateRow, findRow, TABS } from '@/db/sheets';
import { nowTimestampWib } from './format';

export const SETTING_OWNER_CHAT_ID = 'telegram_owner_chat_id';

export interface AppSetting {
  setting_key: string;
  setting_value: string;
  description: string;
  updated_by: string;
  updated_at: string;
}

/** Read a single setting value. Returns '' when unset. */
export async function getSetting(key: string): Promise<string> {
  const rows = await readTab<Record<string, string>>(TABS.appSettings);
  const row = rows.find((r) => r.setting_key === key);
  return row?.setting_value ?? '';
}

/** Upsert a setting value (create or update in place). */
export async function setSetting(key: string, value: string, description: string, userId: string): Promise<void> {
  const found = await findRow(TABS.appSettings, 'setting_key', key);
  const t = nowTimestampWib();
  if (found) {
    await updateRow(TABS.appSettings, found.rowNumber, {
      ...found.row,
      setting_value: value,
      description: description || found.row.description,
      updated_by: userId,
      updated_at: t
    });
    return;
  }
  await appendRows(TABS.appSettings, [{
    setting_key: key,
    setting_value: value,
    description,
    updated_by: userId,
    updated_at: t
  }]);
}

/**
 * Resolve the Telegram owner chat id. Priority:
 * 1. app_settings tab (UI-editable)
 * 2. TELEGRAM_CHAT_ID env (fallback)
 */
export async function getOwnerChatId(): Promise<string> {
  const fromSettings = await getSetting(SETTING_OWNER_CHAT_ID);
  if (fromSettings) return fromSettings;
  return process.env.TELEGRAM_CHAT_ID ?? '';
}
