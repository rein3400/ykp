import paramiko

HOST = "187.77.114.168"
USER = "dev"
PWD = "password"

BASE = "/home/dev/ykp/ykp-hr-v1"

def apply(path, replacements):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PWD, timeout=30)
    sftp = c.open_sftp()
    with sftp.open(path, "r") as f:
        content = f.read().decode("utf-8")
    for old, new in replacements:
        n = content.count(old)
        if n != 1:
            print(f"FAIL {path}: pattern count={n} for: {old[:60]!r}")
            sftp.close(); c.close()
            return False
        content = content.replace(old, new)
    with sftp.open(path, "w") as f:
        f.write(content)
    sftp.close(); c.close()
    print(f"OK {path}")
    return True

# 1. sheets.ts — add telegramLinkCodes tab
ok1 = apply(f"{BASE}/src/db/sheets.ts", [
    (
        "  // Telegram delivery log (notification wiring)\n  telegramDeliveryLog: 'telegram_delivery_log'\n} as const;",
        "  // Telegram delivery log (notification wiring)\n  telegramDeliveryLog: 'telegram_delivery_log',\n  // Telegram link codes (persisted so codes survive app restarts)\n  telegramLinkCodes: 'telegram_link_codes'\n} as const;"
    ),
    (
        "  [TABS.telegramDeliveryLog]: [\n    'delivery_id',\n    'source_module',\n    'source_reference_id',\n    'message_type',\n    'recipient',\n    'message_id',\n    'status',\n    'retry_count',\n    'sent_at',\n    'error_message',\n    'created_at'\n  ]\n};",
        "  [TABS.telegramDeliveryLog]: [\n    'delivery_id',\n    'source_module',\n    'source_reference_id',\n    'message_type',\n    'recipient',\n    'message_id',\n    'status',\n    'retry_count',\n    'sent_at',\n    'error_message',\n    'created_at'\n  ],\n  [TABS.telegramLinkCodes]: [\n    'code',\n    'user_id',\n    'expires_at',\n    'telegram_chat_id',\n    'consumed_at',\n    'created_at'\n  ]\n};"
    ),
])

# 2. telegram.ts — import findRow/updateRow
ok2 = apply(f"{BASE}/src/lib/telegram.ts", [
    (
        "import { appendRows, readTab, TABS } from '@/db/sheets';",
        "import { appendRows, readTab, findRow, updateRow, TABS } from '@/db/sheets';"
    ),
])

# 3. telegram.ts — replace in-memory Map with Sheets persistence
ok3 = apply(f"{BASE}/src/lib/telegram.ts", [
    (
        "const CODE_TTL_MS = 10 * 60_000; // 10 minutes\n\n/** In-memory pending link codes: code → { userId, expiresAt }. */\nconst pendingCodes = new Map<string, { userId: string; expiresAt: number }>();\n\n/** Generate a fresh 6-char link code bound to a user id. */\nexport function createLinkCode(userId: string): string {\n  const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');\n  pendingCodes.set(code, { userId, expiresAt: Date.now() + CODE_TTL_MS });\n  // Opportunistic cleanup.\n  for (const [k, v] of pendingCodes) if (v.expiresAt < Date.now()) pendingCodes.delete(k);\n  return code;\n}\n\n/**\n * Consume a link code and bind the Telegram chat id to the user.\n * Returns the bound user_id, or null if the code is invalid/expired.\n */\nexport async function consumeLinkCode(code: string, telegramChatId: string): Promise<string | null> {\n  const normalized = (code || '').trim().toUpperCase();\n  const entry = pendingCodes.get(normalized);\n  if (!entry || entry.expiresAt < Date.now()) return null;\n  pendingCodes.delete(normalized);\n  const user = await findRow(TABS.users, 'user_id', entry.userId).catch(() => null);\n  if (!user) return null;\n  await updateRow(TABS.users, user.rowNumber, { ...user.row, telegram_id: telegramChatId }).catch(() => null);\n  // Also bind master_employee.telegram_id so the absen bot can resolve the employee.\n  const employeeId = (user.row.employee_id ?? '').trim();\n  if (employeeId) {\n    const emp = await findRow(TABS.employees, 'employee_id', employeeId).catch(() => null);\n    if (emp) {\n      await updateRow(TABS.employees, emp.rowNumber, { ...emp.row, telegram_id: telegramChatId }).catch(() => null);\n    }\n  }\n  return entry.userId;\n}",
        "const CODE_TTL_MS = 10 * 60_000; // 10 minutes\n\n/** Generate a fresh 6-char link code bound to a user id, persisted to Sheets. */\nexport async function createLinkCode(userId: string): Promise<string> {\n  const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');\n  await appendRows(TABS.telegramLinkCodes, [{\n    code,\n    user_id: userId,\n    expires_at: String(Date.now() + CODE_TTL_MS),\n    telegram_chat_id: '',\n    consumed_at: '',\n    created_at: nowTimestampWib()\n  }]).catch(() => null);\n  return code;\n}\n\n/**\n * Consume a link code and bind the Telegram chat id to the user.\n * Returns the bound user_id, or null if the code is invalid/expired/consumed.\n */\nexport async function consumeLinkCode(code: string, telegramChatId: string): Promise<string | null> {\n  const normalized = (code || '').trim().toUpperCase();\n  const codeRow = await findRow(TABS.telegramLinkCodes, 'code', normalized).catch(() => null);\n  if (!codeRow) return null;\n  const entry = codeRow.row;\n  if (entry.consumed_at) return null;\n  const expiresAt = Number(entry.expires_at);\n  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;\n  const userId = entry.user_id;\n  const user = await findRow(TABS.users, 'user_id', userId).catch(() => null);\n  if (!user) return null;\n  await updateRow(TABS.users, user.rowNumber, { ...user.row, telegram_id: telegramChatId }).catch(() => null);\n  // Also bind master_employee.telegram_id so the absen bot can resolve the employee.\n  const employeeId = (user.row.employee_id ?? '').trim();\n  if (employeeId) {\n    const emp = await findRow(TABS.employees, 'employee_id', employeeId).catch(() => null);\n    if (emp) {\n      await updateRow(TABS.employees, emp.rowNumber, { ...emp.row, telegram_id: telegramChatId }).catch(() => null);\n    }\n  }\n  await updateRow(TABS.telegramLinkCodes, codeRow.rowNumber, {\n    ...entry,\n    telegram_chat_id: telegramChatId,\n    consumed_at: nowTimestampWib()\n  }).catch(() => null);\n  return userId;\n}"
    ),
])

# 4. link route.ts — await createLinkCode
ok4 = apply(f"{BASE}/src/app/api/hr/telegram/link/route.ts", [
    (
        "  const code = createLinkCode(s.userId);",
        "  const code = await createLinkCode(s.userId);"
    ),
])

print("ALL:", ok1 and ok2 and ok3 and ok4)
