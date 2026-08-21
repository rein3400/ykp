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

const TABS = [
  'master_brand', 'master_outlet', 'master_supplier',
  'fin_expense_category', 'fin_payment_method', 'fin_petty_cash_account',
  'fin_pos_daily', 'fin_pos_items', 'fin_supplier_cost', 'fin_petty_cash',
  'fin_expense', 'fin_closing_cash', 'fin_daily_summary',
  'finance_alert_log', 'finance_action_tracker', 'finance_threshold_config',
  'users', 'audit_log', 'telegram_delivery_log'
];

async function main() {
  const meta = await s.spreadsheets.get({ spreadsheetId: sid });
  const sheetNames = meta.data.sheets.map(sh => sh.properties.title);
  console.log('=== all tabs in spreadsheet ===');
  console.log(sheetNames.join('\n'));
  console.log('');

  console.log('=== row counts (incl header) ===');
  for (const tab of TABS) {
    if (!sheetNames.includes(tab)) {
      console.log(tab, '-> MISSING TAB');
      continue;
    }
    try {
      const res = await s.spreadsheets.values.get({ spreadsheetId: sid, range: `${tab}!A1:Z1000` });
      const rows = res.data.values || [];
      const dataRows = rows.length > 1 ? rows.length - 1 : 0;
      console.log(`${tab}: ${rows.length} rows (${dataRows} data)`);
    } catch (e) {
      console.log(tab, '-> ERR', e.message);
    }
  }
}
main().then(() => console.log('DONE')).catch(e => { console.log('ERR', e.message); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-finance-v1/check_all_tabs.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-finance-v1 && node check_all_tabs.js"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=120)
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
