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

async function main() {
  // users tab
  const u = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'users!A1:Z20' });
  console.log('=== users tab ===');
  console.log(JSON.stringify(u.data.values, null, 1));
  // ops_daily_summary
  const o = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'ops_daily_summary!A1:Z10' });
  console.log('=== ops_daily_summary ===');
  console.log(JSON.stringify(o.data.values, null, 1));
  // finance f1_penerimaan
  const f = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'f1_penerimaan!A1:Z5' });
  console.log('=== f1_penerimaan ===');
  console.log(JSON.stringify(f.data.values, null, 1));
}
main().catch(e => console.log('ERR', e.message));
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-hr-v1/check_tabs.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-hr-v1 && node check_tabs.js"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
print(stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:', err)
ssh.close()
