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

const TABS = [
  'master_brand', 'master_outlet', 'master_employee', 'master_role', 'master_shift',
  'master_payroll_rule', 'master_lateness_rule', 'master_leave_type',
  'hr_attendance', 'hr_roster', 'hr_lateness', 'hr_leave_request', 'hr_payroll', 'hr_adjustment',
  'hr_daily_summary', 'users', 'audit_log', 'hermes_alert_log', 'telegram_delivery_log'
];

async function main() {
  for (const tab of TABS) {
    try {
      const r = await s.spreadsheets.values.get({ spreadsheetId: sid, range: tab + '!A1:1' });
      const header = (r.data.values && r.data.values[0]) || [];
      console.log('=== ' + tab + ' (' + header.length + ' cols) ===');
      console.log(header.join('|'));
    } catch (e) {
      console.log('=== ' + tab + ' === ERROR: ' + e.message);
    }
  }
}
main();
"""

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-hr-v1/dump_headers.js', 'w') as f:
    f.write(NODE_SCRIPT)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; cd /home/dev/ykp/ykp-hr-v1 && node dump_headers.js"
stdin, stdout, stderr = ssh.exec_command(cmd)
print('STDOUT:\n' + stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:\n' + err)
ssh.close()
