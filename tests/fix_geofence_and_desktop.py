import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

sftp = ssh.open_sftp()

# --- Fix 1: attendance-service.ts — geofence exemption for management roles ---
svc_path = '/home/dev/ykp/ykp-hr-v1/src/lib/attendance-service.ts'
with sftp.file(svc_path, 'r') as f:
    svc = f.read().decode()

old_const = "import type { SessionUser } from '@/lib/session';\n\nexport interface AttendanceActor {"
new_const = "import type { SessionUser } from '@/lib/session';\n\n/** Roles exempt from outlet geofence (central management, not tied to one outlet). */\nconst GEO_EXEMPT_ROLES = new Set(['owner', 'super_admin', 'hr_admin', 'finance_admin']);\n\nexport interface AttendanceActor {"
if old_const in svc:
    svc = svc.replace(old_const, new_const)
    print('[svc] added GEO_EXEMPT_ROLES')
else:
    print('[svc] WARNING: const anchor not found')

old_reject = "    if (verdict.outsideRadius) {"
new_reject = "    if (verdict.outsideRadius && !GEO_EXEMPT_ROLES.has(input.actor.role)) {"
if old_reject in svc:
    svc = svc.replace(old_reject, new_reject)
    print('[svc] geofence rejection now skips management roles')
else:
    print('[svc] WARNING: reject anchor not found')

with sftp.file(svc_path, 'w') as f:
    f.write(svc)

# --- Fix 2: route.ts — handle "Kirim Lokasi" text + better locLabel ---
route_path = '/home/dev/ykp/ykp-hr-v1/src/app/api/hr/attendance/telegram/route.ts'
with sftp.file(route_path, 'r') as f:
    route = f.read().decode()

old_label = "    const locLabel = r.check_in_location === 'INSIDE_RADIUS' ? 'di dalam radius outlet' : 'tanpa lokasi';"
new_label = "    const locLabel = r.check_in_location === 'INSIDE_RADIUS' ? 'di dalam radius outlet' : r.check_in_location === 'OUTSIDE_RADIUS' ? 'di luar radius (dikecualikan)' : 'tanpa lokasi';"
if old_label in route:
    route = route.replace(old_label, new_label)
    print('[route] locLabel improved')
else:
    print('[route] WARNING: locLabel anchor not found')

old_fallback = "  await reply('Perintah tidak dikenali.', locationReplyMarkup());\n  return ok({ ok: true });"
new_fallback = "  if ((msg.text ?? '').trim().toLowerCase() === 'kirim lokasi') {\n    await reply('📍 Kirim lokasi kamu. Di desktop: klik ikon 📎 → Location → pilih lokasi di peta.', locationReplyMarkup());\n    return ok({ ok: true, needs_location: true });\n  }\n  await reply('Perintah tidak dikenali. Ketik /help untuk bantuan.', locationReplyMarkup());\n  return ok({ ok: true });"
if old_fallback in route:
    route = route.replace(old_fallback, new_fallback)
    print('[route] "Kirim Lokasi" text handled')
else:
    print('[route] WARNING: fallback anchor not found')

with sftp.file(route_path, 'w') as f:
    f.write(route)

# --- Fix 3: telegram-attendance.ts — better HELP_TEXT ---
tg_path = '/home/dev/ykp/ykp-hr-v1/src/lib/telegram-attendance.ts'
with sftp.file(tg_path, 'r') as f:
    tg = f.read().decode()

old_help = """export const HELP_TEXT = [
  'YKP HR Absen Bot',
  '',
  '/masuk — absen masuk (kirim lokasi atau langsung /masuk)',
  '/pulang — absen pulang',
  '/help — bantuan',
  '',
  'Untuk deteksi lokasi: kirim lokasi Telegram, atau /masuk lalu tekan tombol "Kirim Lokasi".'
].join('\\n');"""
new_help = """export const HELP_TEXT = [
  'YKP HR Absen Bot',
  '',
  '/masuk — absen masuk',
  '/pulang — absen pulang',
  '/help — bantuan',
  '',
  'Cara absen masuk:',
  '1. Kirim /masuk',
  '2. Kirim lokasi kamu:',
  '   • HP: tekan tombol "Kirim Lokasi"',
  '   • Desktop: klik ikon 📎 → Location → pilih lokasi di peta',
  '',
  'Lokasi harus dalam radius outlet (kecuali role manajemen).'
].join('\\n');"""
if old_help in tg:
    tg = tg.replace(old_help, new_help)
    print('[tg] HELP_TEXT updated')
else:
    print('[tg] WARNING: HELP_TEXT anchor not found')

with sftp.file(tg_path, 'w') as f:
    f.write(tg)

sftp.close()

# --- Fix 4: link U-001 (owner) -> EMP-001 in users tab ---
NODE_SCRIPT = r"""
const { google } = require('googleapis');
const fs = require('fs');
const env = fs.readFileSync('/home/dev/ykp/ykp-hr-v1/.env', 'utf8');
function get(k) {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
  if (!m) return '';
  return m[1].replace(/^"|"$/g, '');
}
const email = get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
const key = get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY').replace(/\\n/g, '\n');
const sid = get('YKP_HR_SPREADSHEET_ID');
const auth = new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const s = google.sheets({ version: 'v4', auth });
async function main() {
  const r = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'users!A1:J50' });
  const rows = r.data.values || [];
  const header = rows[0] || [];
  const idIdx = header.indexOf('user_id');
  const empIdx = header.indexOf('employee_id');
  console.log('users header:', header.join('|'));
  console.log('employee_id col idx:', empIdx);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const uid = row[idIdx] || '';
    if (uid === 'U-001') {
      const col = String.fromCharCode(65 + empIdx);
      await s.spreadsheets.values.update({
        spreadsheetId: sid,
        range: 'users!' + col + (i + 1),
        valueInputOption: 'RAW',
        requestBody: { values: [['EMP-001']] }
      });
      console.log('linked U-001 -> EMP-001 at row', i + 1, 'col', col);
    }
  }
}
main().catch(e => console.log('ERR', e.message));
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-hr-v1/link_owner.js', 'w') as f:
    f.write(NODE_SCRIPT)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; cd /home/dev/ykp/ykp-hr-v1 && node link_owner.js"
stdin, stdout, stderr = ssh.exec_command(cmd)
print('LINK OWNER:\n' + stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:\n' + err)

# --- Rebuild + restart ---
cmd2 = r"""
export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd /home/dev/ykp/ykp-hr-v1
npm run build 2>&1 | tail -5
pm2 restart ykp-hr-v1 --update-env 2>&1
sleep 5
pm2 list 2>&1 | grep ykp-hr-v1
"""
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=300)
print('BUILD/RESTART:\n' + stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:\n' + err)

ssh.close()
