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
s.spreadsheets.values.get({
  spreadsheetId: g('YKP_HR_SPREADSHEET_ID'),
  range: 'hr_attendance!A1:A1620'
}).then(r => {
  const rows = r.data.values || [];
  console.log('TOTAL ROWS:', rows.length);
  for (let i = 0; i < rows.length; i++) {
    const v = (rows[i] && rows[i][0]) || '';
    if (v === 'ATT-256' || v === 'ATT-255' || v === 'ATT-257') {
      console.log('FOUND', v, 'at row', i + 1);
    }
  }
  // print last 10 non-empty
  let printed = 0;
  for (let i = rows.length - 1; i >= 0 && printed < 10; i--) {
    const v = (rows[i] && rows[i][0]) || '';
    if (v) { console.log('LAST', i + 1, v); printed++; }
  }
}).catch(e => console.log('ERR', e.message));
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-hr-v1/find_att256b.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; cd /home/dev/ykp/ykp-hr-v1 && node find_att256b.js"
stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:', err)
ssh.close()
