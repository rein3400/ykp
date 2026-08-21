import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

NODE = r"""
const { google } = require('googleapis');
const fs = require('fs');
const bcrypt = require('/home/dev/ykp/ykp-finance-v1/node_modules/bcryptjs');
const { createHash } = require('crypto');
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

async function main() {
  const res = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'users!A1:I30' });
  const rows = res.data.values || [];
  console.log('users rows:', rows.length);
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const username = r[1] || '';
    const hash = r[2] || '';
    const role = r[3] || '';
    const active = r[6] || '';
    if (username === 'owner' || username === 'admin' || i < 6) {
      let bcryptOk = false, shaOk = false;
      if (hash.startsWith('$2')) {
        bcryptOk = await bcrypt.compare('owner123', hash);
      } else if (/^[a-f0-9]{64}$/i.test(hash)) {
        shaOk = createHash('sha256').update('owner123').digest('hex') === hash.toLowerCase();
      }
      console.log(`row ${i}: user=${username} role=${role} active=${active} hashPrefix=${hash.slice(0,7)} bcrypt(owner123)=${bcryptOk} sha(owner123)=${shaOk}`);
    }
  }
}
main().then(() => console.log('DONE')).catch(e => { console.log('ERR', e.message); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-finance-v1/check_users.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-finance-v1 && node check_users.js"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
