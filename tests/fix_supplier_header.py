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

// Old layout (data currently in sheet):
// supplier_id, supplier_code, supplier_name, category, phone, email, address, bank_name, bank_account, account_holder
// New header (TAB_HEADERS):
// supplier_id, supplier_name, category, phone, bank_name, bank_account, account_holder, status, created_at, updated_at
const NEW_HEADER = ['supplier_id','supplier_name','category','phone','bank_name','bank_account','account_holder','status','created_at','updated_at'];

async function main() {
  const res = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'master_supplier!A1:J100' });
  const rows = res.data.values || [];
  const data = rows.slice(1).filter(r => r[0]);
  const now = '2026-08-20 00:00:00';

  const remapped = data.map(r => {
    // old: [0]=id [1]=code [2]=name [3]=category [4]=phone [5]=email [6]=address [7]=bank_name [8]=bank_account [9]=account_holder
    return [
      r[0] || '',            // supplier_id
      r[2] || '',            // supplier_name
      r[3] || '',            // category
      r[4] || '',            // phone
      r[7] || '',            // bank_name
      r[8] || '',            // bank_account
      r[9] || '',            // account_holder
      'ACTIVE',              // status
      now,                   // created_at
      now                    // updated_at
    ];
  });

  // Clear the whole tab then write header + data
  await s.spreadsheets.values.clear({ spreadsheetId: sid, range: 'master_supplier!A1:J1000' });
  await s.spreadsheets.values.update({
    spreadsheetId: sid,
    range: 'master_supplier!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [NEW_HEADER, ...remapped] }
  });
  console.log('rewrote master_supplier:', remapped.length, 'data rows');
  remapped.forEach(r => console.log(JSON.stringify(r.slice(0, 4))));
}
main().then(() => console.log('DONE')).catch(e => { console.log('ERR', e.message); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-finance-v1/fix_supplier_header.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-finance-v1 && node fix_supplier_header.js"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
print('=== fix_supplier_header ===')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
