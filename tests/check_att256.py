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
  range: 'hr_attendance!A1:Z50'
}).then(r => {
  const rows = r.data.values || [];
  const h = rows[0] || [];
  console.log('HEADER:', h.join('|'));
  const idIdx = h.indexOf('attendance_id');
  const empIdx = h.indexOf('employee_id');
  const dateIdx = h.indexOf('date');
  const ciIdx = h.indexOf('check_in_time');
  const locIdx = h.indexOf('check_in_location');
  const latIdx = h.indexOf('check_in_latitude');
  const lonIdx = h.indexOf('check_in_longitude');
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    if (row[idIdx] === 'ATT-256') {
      console.log(JSON.stringify({
        attendance_id: row[idIdx],
        employee_id: row[empIdx],
        date: row[dateIdx],
        check_in_time: row[ciIdx],
        check_in_location: row[locIdx],
        lat: row[latIdx],
        lon: row[lonIdx]
      }));
    }
  }
}).catch(e => console.log('ERR', e.message));
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-hr-v1/check_att256.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; cd /home/dev/ykp/ykp-hr-v1 && node check_att256.js"
stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:', err)
ssh.close()
