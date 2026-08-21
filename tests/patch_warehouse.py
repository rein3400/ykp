import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=30)
sftp = c.open_sftp()

def read(path):
    with sftp.open(path, 'r') as f:
        return f.read().decode('utf-8')

def write(path, content):
    with sftp.open(path, 'w') as f:
        f.write(content)

def patch(path, old, new, count=1):
    content = read(path)
    n = content.count(old)
    if n != count:
        raise AssertionError(f"{path}: expected {count} occurrence(s), found {n}\n--- old ---\n{old[:200]}")
    content = content.replace(old, new)
    write(path, content)
    print(f"OK {path}")

base = '/home/dev/ykp/ykp-warehouse-v1'

# 1. telegram.ts — replace in-memory linking with Sheets persistence
old = '''// ── Telegram identity linking (P0) ────────────────────────────────────
const CODE_TTL_MS = 10 * 60_000;
const pendingCodes = new Map<string, { userId: string; expiresAt: number }>();

/** Generate a fresh 6-char link code bound to a user id. */
export function createLinkCode(userId: string): string {
  const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  pendingCodes.set(code, { userId, expiresAt: Date.now() + CODE_TTL_MS });
  for (const [k, v] of pendingCodes) if (v.expiresAt < Date.now()) pendingCodes.delete(k);
  return code;
}

/** Consume a link code and bind the Telegram chat id to the user. */
export async function consumeLinkCode(code: string, telegramChatId: string): Promise<string | null> {
  const entry = pendingCodes.get((code || '').trim().toUpperCase());
  if (!entry || entry.expiresAt < Date.now()) return null;
  pendingCodes.delete(code.trim().toUpperCase());
  const user = await findRow(TABS.users, 'user_id', entry.userId).catch(() => null);
  if (!user) return null;
  await updateRow(TABS.users, user.rowNumber, { ...user.row, telegram_id: telegramChatId }).catch(() => null);
  return entry.userId;
}'''
new = '''// ── Telegram identity linking (P0) ────────────────────────────────────
const CODE_TTL_MS = 10 * 60_000;
const DIVISION = 'warehouse';

/** Generate a fresh 6-char link code bound to a user id, persisted to Sheets. */
export async function createLinkCode(userId: string): Promise<string> {
  const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  await appendRows(TABS.telegramLinkCodes, [{
    code,
    user_id: userId,
    expires_at: String(Date.now() + CODE_TTL_MS),
    telegram_chat_id: '',
    consumed_at: '',
    created_at: nowTimestampWib(),
    division: DIVISION
  }]).catch(() => null);
  return code;
}

/** Consume a link code and bind the Telegram chat id to the user. */
export async function consumeLinkCode(code: string, telegramChatId: string): Promise<string | null> {
  const normalized = (code || '').trim().toUpperCase();
  const codeRow = await findRow(TABS.telegramLinkCodes, 'code', normalized).catch(() => null);
  if (!codeRow) return null;
  const entry = codeRow.row;
  if (entry.consumed_at) return null;
  const expiresAt = Number(entry.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  const userId = entry.user_id;
  const user = await findRow(TABS.users, 'user_id', userId).catch(() => null);
  if (!user) return null;
  await updateRow(TABS.users, user.rowNumber, { ...user.row, telegram_id: telegramChatId }).catch(() => null);
  await updateRow(TABS.telegramLinkCodes, codeRow.rowNumber, {
    ...entry,
    telegram_chat_id: telegramChatId,
    consumed_at: nowTimestampWib()
  }).catch(() => null);
  return userId;
}'''
patch(f'{base}/src/lib/telegram.ts', old, new)

# 2. sheets.ts — add telegramLinkCodes to TABS (after telegramDeliveryLog)
old = '''  dailySummary: 'warehouse_daily_summary',
  telegramDeliveryLog: 'telegram_delivery_log',
  // ── Auth + audit + evidence ──────────────────────────────────'''
new = '''  dailySummary: 'warehouse_daily_summary',
  telegramDeliveryLog: 'telegram_delivery_log',
  telegramLinkCodes: 'telegram_link_codes',
  // ── Auth + audit + evidence ──────────────────────────────────'''
patch(f'{base}/src/db/sheets.ts', old, new)

# 3. sheets.ts — add telegramLinkCodes header (after telegramDeliveryLog header)
old = '''  [TABS.telegramDeliveryLog]: [
    'delivery_id', 'source_module', 'source_reference_id', 'message_type',
    'recipient', 'message_id', 'status', 'retry_count', 'sent_at',
    'error_message', 'created_at'
  ],
  // ── Auth + audit ─────────────────────────────────────────────'''
new = '''  [TABS.telegramDeliveryLog]: [
    'delivery_id', 'source_module', 'source_reference_id', 'message_type',
    'recipient', 'message_id', 'status', 'retry_count', 'sent_at',
    'error_message', 'created_at'
  ],
  [TABS.telegramLinkCodes]: [
    'code', 'user_id', 'expires_at', 'telegram_chat_id', 'consumed_at', 'created_at', 'division'
  ],
  // ── Auth + audit ─────────────────────────────────────────────'''
patch(f'{base}/src/db/sheets.ts', old, new)

# 4. link route — await createLinkCode
old = "  const code = createLinkCode(s.userId);"
new = "  const code = await createLinkCode(s.userId);"
patch(f'{base}/src/app/api/warehouse/telegram/link/route.ts', old, new)

print("WAREHOUSE DONE")
c.close()
