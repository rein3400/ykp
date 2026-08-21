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
        raise AssertionError(f"{path}: expected {count} occurrence(s), found {n}\n--- old ---\n{old[:300]}")
    content = content.replace(old, new)
    write(path, content)
    print(f"OK {path}")

base = '/home/dev/ykp/ykp-hr-v1'

# 1. sheets.ts — add investorUsers + opsUsers to TABS
old = '''  // Telegram link codes (persisted so codes survive app restarts)
  telegramLinkCodes: 'telegram_link_codes'
} as const;'''
new = '''  // Telegram link codes (persisted so codes survive app restarts)
  telegramLinkCodes: 'telegram_link_codes',
  // Cross-division user tabs (shared spreadsheet; bot routes by division)
  investorUsers: 'investor_users',
  opsUsers: 'ops_users'
} as const;'''
patch(f'{base}/src/db/sheets.ts', old, new)

# 2. sheets.ts — add division to telegramLinkCodes header + add investorUsers/opsUsers headers
old = '''  [TABS.telegramLinkCodes]: [
    'code',
    'user_id',
    'expires_at',
    'telegram_chat_id',
    'consumed_at',
    'created_at'
  ]
};'''
new = '''  [TABS.telegramLinkCodes]: [
    'code',
    'user_id',
    'expires_at',
    'telegram_chat_id',
    'consumed_at',
    'created_at',
    'division'
  ],
  [TABS.investorUsers]: [
    'user_id', 'username', 'password_hash', 'role',
    'investor_id', 'department', 'telegram_id', 'active_status', 'created_at', 'last_login_at'
  ],
  [TABS.opsUsers]: [
    'user_id', 'username', 'password_hash', 'role', 'brand_id', 'outlet_id',
    'department', 'employee_id', 'telegram_id', 'active_status', 'created_at', 'last_login_at'
  ]
};'''
patch(f'{base}/src/db/sheets.ts', old, new)

# 3. telegram.ts — add division to createLinkCode
old = '''  await appendRows(TABS.telegramLinkCodes, [{
    code,
    user_id: userId,
    expires_at: String(Date.now() + CODE_TTL_MS),
    telegram_chat_id: '',
    consumed_at: '',
    created_at: nowTimestampWib()
  }]).catch(() => null);
  return code;'''
new = '''  await appendRows(TABS.telegramLinkCodes, [{
    code,
    user_id: userId,
    expires_at: String(Date.now() + CODE_TTL_MS),
    telegram_chat_id: '',
    consumed_at: '',
    created_at: nowTimestampWib(),
    division: 'hr'
  }]).catch(() => null);
  return code;'''
patch(f'{base}/src/lib/telegram.ts', old, new)

# 4. telegram.ts — route consume by division
old = '''  const userId = entry.user_id;
  const user = await findRow(TABS.users, 'user_id', userId).catch(() => null);
  if (!user) return null;
  await updateRow(TABS.users, user.rowNumber, { ...user.row, telegram_id: telegramChatId }).catch(() => null);
  // Also bind master_employee.telegram_id so the absen bot can resolve the employee.
  const employeeId = (user.row.employee_id ?? '').trim();
  if (employeeId) {
    const emp = await findRow(TABS.employees, 'employee_id', employeeId).catch(() => null);
    if (emp) {
      await updateRow(TABS.employees, emp.rowNumber, { ...emp.row, telegram_id: telegramChatId }).catch(() => null);
    }
  }
  await updateRow(TABS.telegramLinkCodes, codeRow.rowNumber, {
    ...entry,
    telegram_chat_id: telegramChatId,
    consumed_at: nowTimestampWib()
  }).catch(() => null);
  return userId;'''
new = '''  const userId = entry.user_id;
  const division = (entry.division ?? 'hr').trim().toLowerCase();
  // hr/finance/warehouse share the `users` tab; investor/ops have their own.
  const userTab = division === 'investor' ? TABS.investorUsers
    : division === 'ops' ? TABS.opsUsers
    : TABS.users;
  const user = await findRow(userTab, 'user_id', userId).catch(() => null);
  if (!user) return null;
  await updateRow(userTab, user.rowNumber, { ...user.row, telegram_id: telegramChatId }).catch(() => null);
  // Bind master_employee.telegram_id only for HR so the absen bot can resolve the employee.
  if (division === 'hr') {
    const employeeId = (user.row.employee_id ?? '').trim();
    if (employeeId) {
      const emp = await findRow(TABS.employees, 'employee_id', employeeId).catch(() => null);
      if (emp) {
        await updateRow(TABS.employees, emp.rowNumber, { ...emp.row, telegram_id: telegramChatId }).catch(() => null);
      }
    }
  }
  await updateRow(TABS.telegramLinkCodes, codeRow.rowNumber, {
    ...entry,
    telegram_chat_id: telegramChatId,
    consumed_at: nowTimestampWib()
  }).catch(() => null);
  return userId;'''
patch(f'{base}/src/lib/telegram.ts', old, new)

print("HR DONE")
c.close()
