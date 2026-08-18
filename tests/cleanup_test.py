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
  // 1. clear ATT-256 row (row 861)
  await s.spreadsheets.values.update({
    spreadsheetId: sid,
    range: 'hr_attendance!A861:Z861',
    valueInputOption: 'RAW',
    requestBody: { values: [Array(26).fill('')] }
  });
  console.log('cleared ATT-256 row 861');

  // 2. reset EMP-002 telegram_id to empty
  await s.spreadsheets.values.update({
    spreadsheetId: sid,
    range: 'master_employee!H3',
    valueInputOption: 'RAW',
    requestBody: { values: [['']] }
  });
  console.log('reset EMP-002 telegram_id');
}
main().catch(e => console.log('ERR', e.message));
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-hr-v1/cleanup_test.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; cd /home/dev/ykp/ykp-hr-v1 && node cleanup_test.js"
stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:', err)
ssh.close()
