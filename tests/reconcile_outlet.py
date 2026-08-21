import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

NODE = r"""
const { google } = require('googleapis');
const fs = require('fs');
const env = fs.readFileSync('/home/dev/ykp/ykp-hr-v1/.env', 'utf8');
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
const sid = g('YKP_HR_SPREADSHEET_ID');

// Find OL-003 row index, then update it to Sekarpizza Demangan
async function main() {
  const r = await s.spreadsheets.values.get({
    spreadsheetId: sid,
    range: 'master_outlet!A2:K20'
  });
  const rows = r.data.values || [];
  let idx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === 'OL-003') { idx = i + 2; break; }
  }
  if (idx < 0) { console.log('OL-003 not found'); return; }
  console.log('found OL-003 at row', idx, ':', rows[idx-2]);

  // Update OL-003 to Sekarpizza Demangan (BR-002)
  const newRow = [
    'OL-003',
    'BR-002',
    'Sekarpizza Demangan',
    'SKP-DMG',
    'Jl. Demangan Baru No.10, Yogyakarta',
    '-7.7936',
    '110.3890',
    '100',
    'active',
    '2026-07-10 10:32:24',
    '2026-07-10 10:32:24'
  ];
  await s.spreadsheets.values.update({
    spreadsheetId: sid,
    range: `master_outlet!A${idx}:K${idx}`,
    valueInputOption: 'RAW',
    requestBody: { values: [newRow] }
  });
  console.log('OL-003 updated to Sekarpizza Demangan');

  // Verify
  const v = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'master_outlet!A2:K8' });
  console.log(JSON.stringify(v.data.values, null, 1));
}
main().catch(e => console.log('ERR', e.message));
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-hr-v1/reconcile_outlet.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-hr-v1 && node reconcile_outlet.js"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
