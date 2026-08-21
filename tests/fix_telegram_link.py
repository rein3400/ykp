import paramiko

HOST = '187.77.114.168'
USER = 'dev'
PWD = 'password'

def sftp_edit(remote_path, old, new):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PWD)
    sftp = ssh.open_sftp()
    with sftp.open(remote_path, 'r') as f:
        content = f.read().decode('utf-8')
    if old not in content:
        print(f'ERROR: old string not found in {remote_path}')
        sftp.close(); ssh.close()
        return False
    content = content.replace(old, new, 1)
    with sftp.open(remote_path, 'w') as f:
        f.write(content)
    sftp.close(); ssh.close()
    print(f'EDITED {remote_path}')
    return True

# 1. route.ts: add import
route = '/home/dev/ykp/ykp-hr-v1/src/app/api/hr/attendance/telegram/route.ts'
old_import = "import { safeEqual } from '@/lib/cron';"
new_import = "import { safeEqual } from '@/lib/cron';\nimport { consumeLinkCode } from '@/lib/telegram';"
sftp_edit(route, old_import, new_import)

# 2. route.ts: add link handler before employee resolution
old_block = """  // Resolve the employee by Telegram chat id (brief §6.2 master_employee.telegram_id).
  const employees = await readTab<Record<string, string>>(TABS.employees);"""
new_block = """  // Handle Telegram link code binding (/link KODE or /start KODE).
  const linkMatch = msg.text?.match(/^\\/(?:link|start)\\s+([A-Za-z0-9]{6})$/i);
  if (linkMatch) {
    const code = linkMatch[1].toUpperCase();
    const userId = await consumeLinkCode(code, String(chatId));
    if (userId) {
      await reply('✅ Akun Telegram kamu berhasil terhubung ke akun YKP kamu.');
    } else {
      await reply('❌ Kode tidak valid atau sudah kedaluwarsa. Silakan buat kode baru di halaman Telegram.');
    }
    return ok({ ok: true });
  }

  // Resolve the employee by Telegram chat id (brief §6.2 master_employee.telegram_id).
  const employees = await readTab<Record<string, string>>(TABS.employees);"""
sftp_edit(route, old_block, new_block)

# 3. telegram.ts: fix consumeLinkCode to also bind master_employee.telegram_id
lib = '/home/dev/ykp/ykp-hr-v1/src/lib/telegram.ts'
old_fn = """export async function consumeLinkCode(code: string, telegramChatId: string): Promise<string | null> {
  const entry = pendingCodes.get((code || '').trim().toUpperCase());
  if (!entry || entry.expiresAt < Date.now()) return null;
  pendingCodes.delete(entry.userId ? code.trim().toUpperCase() : '');
  const user = await findRow(TABS.users, 'user_id', entry.userId).catch(() => null);
  if (!user) return null;
  await updateRow(TABS.users, user.rowNumber, { ...user.row, telegram_id: telegramChatId }).catch(() => null);
  return entry.userId;
}"""
new_fn = """export async function consumeLinkCode(code: string, telegramChatId: string): Promise<string | null> {
  const normalized = (code || '').trim().toUpperCase();
  const entry = pendingCodes.get(normalized);
  if (!entry || entry.expiresAt < Date.now()) return null;
  pendingCodes.delete(normalized);
  const user = await findRow(TABS.users, 'user_id', entry.userId).catch(() => null);
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
  return entry.userId;
}"""
sftp_edit(lib, old_fn, new_fn)

print('DONE')
