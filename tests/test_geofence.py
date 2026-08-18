import paramiko
import json

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# Clear ATT-256 (row 857) test artifact
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
  await s.spreadsheets.values.clear({ spreadsheetId: sid, range: 'hr_attendance!A857:Z857' });
  console.log('cleared ATT-256 row 857');
}
main().catch(e => console.log('ERR', e.message));
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-hr-v1/clear_att.js', 'w') as f:
    f.write(NODE_SCRIPT)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; cd /home/dev/ykp/ykp-hr-v1 && node clear_att.js"
stdin, stdout, stderr = ssh.exec_command(cmd)
print('CLEAR:\n' + stdout.read().decode())

# Now test geofence reject
SECRET = '1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52'
URL = 'https://oseedigital.tech/api/hr/attendance/telegram'

def send(payload):
    cmd = f"""curl -s -X POST {URL} -H 'X-Telegram-Bot-Api-Secret-Token: {SECRET}' -H 'Content-Type: application/json' -d '{json.dumps(payload)}' -w '\\nHTTP %{{http_code}}\\n'"""
    stdin, stdout, stderr = ssh.exec_command(cmd)
    return stdout.read().decode()

# Test: /masuk OUTSIDE radius (should reject)
print('=== TEST: /masuk OUTSIDE radius (should reject) ===')
print(send({
    "update_id": 300,
    "message": {"message_id": 300, "chat": {"id": 5721500978, "type": "private"}, "text": "/masuk", "location": {"latitude": -6.5000, "longitude": 107.0000}}
}))

# Test: /masuk INSIDE radius (should succeed)
print('=== TEST: /masuk INSIDE radius (should succeed) ===')
print(send({
    "update_id": 301,
    "message": {"message_id": 301, "chat": {"id": 5721500978, "type": "private"}, "text": "/masuk", "location": {"latitude": -6.2741, "longitude": 106.8006}}
}))

ssh.close()
