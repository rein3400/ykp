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
  const r = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'master_employee!A1:AH5' });
  const rows = r.data.values || [];
  rows.forEach((row, i) => {
    console.log(i + ':', row.join('|'));
  });
  console.log('--- attendance last rows ---');
  const a = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'hr_attendance!A1:Z200' });
  const arows = a.data.values || [];
  console.log('total attendance rows:', arows.length);
  // print last 5
  for (let i = Math.max(1, arows.length - 5); i < arows.length; i++) {
    console.log(i + ':', (arows[i] || []).slice(0, 20).join('|'));
  }
}
main().catch(e => console.log('ERR', e.message));
"""

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-hr-v1/check_emp.js', 'w') as f:
    f.write(NODE_SCRIPT)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; cd /home/dev/ykp/ykp-hr-v1 && node check_emp.js"
stdin, stdout, stderr = ssh.exec_command(cmd)
print('STDOUT:\n' + stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:\n' + err)
ssh.close()
