import paramiko

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
  // Find and clear any ATT-256 (test artifact) rows
  const r = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'hr_attendance!A1:A2000' });
  const rows = r.data.values || [];
  const toClear = [];
  for (let i = 1; i < rows.length; i++) {
    const id = (rows[i] && rows[i][0]) || '';
    if (id === 'ATT-256') toClear.push(i + 1);
  }
  console.log('ATT-256 rows to clear:', toClear);
  for (const rowNum of toClear) {
    await s.spreadsheets.values.clear({ spreadsheetId: sid, range: 'hr_attendance!A' + rowNum + ':Z' + rowNum });
    console.log('cleared row', rowNum);
  }
}
main().catch(e => console.log('ERR', e.message));
"""

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-hr-v1/clear_att3.js', 'w') as f:
    f.write(NODE_SCRIPT)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; cd /home/dev/ykp/ykp-hr-v1 && node clear_att3.js"
stdin, stdout, stderr = ssh.exec_command(cmd)
print('STDOUT:\n' + stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:\n' + err)
ssh.close()
