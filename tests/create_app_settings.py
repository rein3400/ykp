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

const HEADER = ['setting_key', 'setting_value', 'description', 'updated_by', 'updated_at'];

async function main() {
  const meta = await s.spreadsheets.get({ spreadsheetId: sid });
  const exists = meta.data.sheets.some(sh => sh.properties.title === 'app_settings');
  if (!exists) {
    await s.spreadsheets.batchUpdate({
      spreadsheetId: sid,
      requestBody: { requests: [{ addSheet: { properties: { title: 'app_settings' } } }] }
    });
    console.log('created app_settings tab');
  } else {
    console.log('app_settings tab already exists');
  }
  await s.spreadsheets.values.update({
    spreadsheetId: sid,
    range: 'app_settings!A1:E1',
    valueInputOption: 'RAW',
    requestBody: { values: [HEADER] }
  });
  console.log('header written');
}
main().then(() => console.log('DONE')).catch(e => { console.log('ERR', e.message); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-finance-v1/create_app_settings.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-finance-v1 && node create_app_settings.js"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
print('=== create_app_settings ===')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
