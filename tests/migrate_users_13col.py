import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

NODE = r"""
const { google } = require('googleapis');
const fs = require('fs');
const env = fs.readFileSync('/home/dev/ykp/ykp-finance-v1/.env', 'utf8');
function g(k) {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].replace(/^"|"$/g, '') : '';
}
const auth = new google.auth.JWT({
  email: g('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
  key: g('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY').replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const s = google.sheets({ version: 'v4', auth });
const sid = g('YKP_FINANCE_SPREADSHEET_ID');

// Canonical 13-col header (union of HR + finance + warehouse + ops needs)
const NEW_HEADER = [
  'user_id', 'username', 'password_hash', 'role', 'brand_id', 'outlet_id',
  'department', 'employee_id', 'telegram_id', 'active_status',
  'must_change_password', 'created_at', 'last_login_at'
];

async function main() {
  const res = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'users!A1:T1000' });
  const rows = res.data.values || [];
  if (rows.length < 2) { console.log('users tab empty, nothing to migrate'); return; }
  const oldHeader = rows[0];
  console.log('OLD HEADER:', JSON.stringify(oldHeader));
  const idx = (name) => oldHeader.indexOf(name);
  const now = '2026-08-20 00:00:00';

  const newRows = [NEW_HEADER];
  for (const r of rows.slice(1)) {
    const get = (name) => { const i = idx(name); return (i >= 0 && i < r.length) ? r[i] : ''; };
    newRows.push([
      get('user_id'),
      get('username'),
      get('password_hash'),
      get('role'),
      get('brand_id'),
      get('outlet_id'),
      get('department'),
      get('employee_id'),
      get('telegram_id'),
      get('active_status') || 'active',   // default active for existing users
      get('must_change_password') || 'false',
      get('created_at') || now,
      get('last_login_at')
    ]);
  }

  // Clear + rewrite
  await s.spreadsheets.values.clear({ spreadsheetId: sid, range: 'users!A1:T1000' });
  await s.spreadsheets.values.update({
    spreadsheetId: sid,
    range: 'users!A1',
    valueInputOption: 'RAW',
    requestBody: { values: newRows }
  });
  console.log('migrated', newRows.length - 1, 'users to 13-col canonical');
  // print owner row
  const owner = newRows.find(r => r[1] === 'owner');
  console.log('owner row:', JSON.stringify(owner));
}
main().then(() => console.log('DONE')).catch(e => { console.log('ERR', e.message); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-finance-v1/migrate_users_13col.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-finance-v1 && node migrate_users_13col.js"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
print('=== migrate_users_13col ===')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
