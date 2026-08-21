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
  const pd = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'fin_pos_daily!A:Z' });
  const pi = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'fin_pos_items!A:Z' });
  const pdv = pd.data.values || [];
  const piv = pi.data.values || [];
  console.log('pos_daily rows (incl header):', pdv.length);
  console.log('pos_items rows (incl header):', piv.length);
  if (pdv.length > 1) {
    console.log('last daily:', JSON.stringify(pdv[pdv.length - 1].slice(0, 10)));
  }
  if (piv.length > 1) {
    console.log('last item:', JSON.stringify(piv[piv.length - 1].slice(0, 10)));
  }
  // count rows matching the rev import source
  const dailyRev = pdv.filter(r => (r[25] || '').includes('rev/Report'));
  const itemRev = piv.filter(r => (r[14] || '').includes('moka_import'));
  console.log('pos_daily rows with rev source:', dailyRev.length);
  console.log('pos_items rows with moka_import source:', itemRev.length);
}
main().then(() => console.log('DONE')).catch(e => { console.log('ERR', e.message); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-finance-v1/check_rev_import.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-finance-v1 && node check_rev_import.js"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
print('=== check_rev_import ===')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
