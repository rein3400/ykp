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

const header = [
  'outlet_id', 'brand_id', 'outlet_name', 'outlet_code', 'address',
  'latitude', 'longitude', 'attendance_radius_m', 'status', 'created_at', 'updated_at'
];

async function main() {
  const r = await s.spreadsheets.values.update({
    spreadsheetId: sid,
    range: 'master_outlet!A1:K1',
    valueInputOption: 'RAW',
    requestBody: { values: [header] }
  });
  console.log('header updated:', r.data.updatedCells, 'cells');
  const v = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'master_outlet!A1:K2' });
  console.log(JSON.stringify(v.data.values, null, 1));
}
main().catch(e => console.log('ERR', e.message));
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-hr-v1/fix_outlet_header.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-hr-v1 && node fix_outlet_header.js"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
