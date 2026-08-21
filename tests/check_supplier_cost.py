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

async function main() {
  const sc = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'fin_supplier_cost!A:Z' });
  const sup = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'master_supplier!A:Z' });
  const scv = sc.data.values || [];
  const supv = sup.data.values || [];
  console.log('fin_supplier_cost rows (incl header):', scv.length);
  console.log('master_supplier rows (incl header):', supv.length);
  if (scv.length > 1) {
    console.log('sample supplier_cost:', JSON.stringify(scv[1].slice(0, 12)));
  }
  if (supv.length > 1) {
    console.log('sample master_supplier:', JSON.stringify(supv[1].slice(0, 6)));
  }
}
main().then(() => console.log('DONE')).catch(e => { console.log('ERR', e.message); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-finance-v1/check_supplier_cost.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-finance-v1 && node check_supplier_cost.js"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
print('=== check_supplier_cost ===')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
