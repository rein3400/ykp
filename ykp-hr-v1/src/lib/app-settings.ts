/**
 * App settings read/write over the app_settings key-value tab.
 * SMTP credentials live here (DB) so owner can change them from the UI
 * without SSH. Falls back to process.env for backward compatibility.
 *
 * SMTP_PASS is stored masked in list responses; full value only read
 * server-side for sending.
 */
import { readTab, findRow, updateRow, appendRows, TABS } from '@/db/sheets';
import { nowTimestampWib } from './format';

export interface SmtpConfig {
  host: string;
  port: string;
  user: string;
  pass: string;
  secure: string;
  from_name: string;
}

const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure', 'smtp_from_name'] as const;
export type SmtpKey = (typeof SMTP_KEYS)[number];

function maskPass(v: string): string {
  if (!v) return '';
  return v.length <= 4 ? '****' : `${v.slice(0, 2)}****${v.slice(-2)}`;
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const rows = await readTab<Record<string, string>>(TABS.appSettings);
  const byKey = new Map(rows.map((r) => [r.setting_key, r.setting_value]));
  const get = (k: string, fallback = ''): string => (byKey.get(k) ?? '').trim() || fallback;

  return {
    host: get('smtp_host', process.env.SMTP_HOST ?? ''),
    port: get('smtp_port', process.env.SMTP_PORT ?? '587'),
    user: get('smtp_user', process.env.SMTP_USER ?? ''),
    pass: get('smtp_pass', process.env.SMTP_PASS ?? ''),
    secure: get('smtp_secure', process.env.SMTP_SECURE ?? 'false'),
    from_name: get('smtp_from_name', 'YKP HR')
  };
}

export async function getSmtpConfigMasked(): Promise<Record<string, string>> {
  const cfg = await getSmtpConfig();
  return {
    smtp_host: cfg.host,
    smtp_port: cfg.port,
    smtp_user: cfg.user,
    smtp_pass: cfg.pass ? maskPass(cfg.pass) : '',
    smtp_secure: cfg.secure,
    smtp_from_name: cfg.from_name,
    configured: cfg.host && cfg.user && cfg.pass ? 'true' : 'false'
  };
}

export async function saveSmtpConfig(values: Partial<Record<SmtpKey, string>>, updatedBy: string): Promise<void> {
  const now = nowTimestampWib();
  for (const key of SMTP_KEYS) {
    const value = values[key];
    if (value === undefined) continue;
    const found = await findRow(TABS.appSettings, 'setting_key', key);
    if (found) {
      await updateRow(TABS.appSettings, found.rowNumber, {
        ...found.row,
        setting_value: value,
        updated_at: now,
        updated_by: updatedBy
      });
    } else {
      await appendRows(TABS.appSettings, [{
        setting_key: key,
        setting_value: value,
        updated_at: now,
        updated_by: updatedBy
      }]);
    }
  }
}