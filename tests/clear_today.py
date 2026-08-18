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
s.spreadsheets.values.get({ spreadsheetId: sid, range: 'hr_attendance!A1:A1620' }).then(r => {
  const rows = r.data.values || [];
  // find rows with date 2026-08-18 (col B) — need full row. Just find ATT-004 and ATT-256 rows
  const targets = [];
  for (let i = 0; i < rows.length; i++) {
    const v = (rows[i] && rows[i][0]) || '';
    if (v === 'ATT-004' || v === 'ATT-256') targets.push(i + 1);
  }
  console.log('target rows:', targets);
  // clear those rows (set A cell empty)
  const reqs = targets.map(r => ({
    range: 'hr_attendance!A' + r + ':Z' + r,
    values: [Array(26).fill('')]
  }));
  return s.spreadsheets.values.batchUpdate({
    spreadsheetId: sid,
    requestBody: { valueInputOption: 'RAW', data: reqs }
  });
}).then(() => console.log('cleared')).catch(e => console.log('ERR', e.message));
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-hr-v1/clear_today.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; cd /home/dev/ykp/ykp-hr-v1 && node clear_today.js"
stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:', err)
ssh.close()
