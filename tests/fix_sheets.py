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

const HEADERS = {
  master_employee: ['employee_id','employee_code','full_name','nickname','gender','phone','email','telegram_id','address','date_of_birth','join_date','employment_status','contract_type','department','role','position','brand_id','outlet_id','supervisor_id','basic_salary','salary_type','bank_name','bank_account','account_holder','bpjs_status','tax_status','emergency_contact_name','emergency_contact_phone','photo_url','active_status','created_at','updated_at','created_by','updated_by'],
  master_outlet: ['outlet_id','brand_id','outlet_name','outlet_code','address','latitude','longitude','attendance_radius_m','status','created_at','updated_at'],
  master_shift: ['shift_id','shift_name','brand_id','outlet_id','start_time','end_time','break_minutes','late_tolerance_minutes','overtime_rule_id','active_status','created_at'],
  users: ['user_id','username','password_hash','role','brand_id','outlet_id','active_status','created_at','last_login_at','employee_id']
};

function colLetter(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

async function rewriteHeader(tab, headers) {
  const last = colLetter(headers.length);
  await s.spreadsheets.values.update({
    spreadsheetId: sid,
    range: tab + '!A1:' + last + '1',
    valueInputOption: 'RAW',
    requestBody: { values: [headers] }
  });
  console.log('[header] ' + tab + ' -> ' + headers.length + ' cols');
}

// Correct Jakarta Selatan coords (lat, lon) per outlet
const OUTLET_COORDS = {
  'OL-001': ['-6.2741', '106.8006'],
  'OL-002': ['-6.2607', '106.8105'],
  'OL-003': ['-6.2383', '106.8260'],
  'OL-004': ['-6.2383', '106.8260'],
  'OL-005': ['-6.2607', '106.8105'],
  'OL-006': ['-6.2250', '106.8000'],
  'OL-007': ['-6.2650', '106.7800'],
  'OL-008': ['-6.2383', '106.8260'],
  'OL-009': ['-6.1950', '106.8400'],
  'OL-010': ['-6.2607', '106.8105']
};

async function fixOutlets() {
  const r = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'master_outlet!A1:M50' });
  const rows = r.data.values || [];
  const header = rows[0] || [];
  const idIdx = header.indexOf('outlet_id');
  const nameIdx = header.indexOf('outlet_name');
  const codeIdx = header.indexOf('outlet_code');
  const addrIdx = header.indexOf('address');
  const statusIdx = header.indexOf('status');
  const createdIdx = header.indexOf('created_at');
  const updatedIdx = header.indexOf('updated_at');
  const brandIdx = header.indexOf('brand_id');

  const newRows = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const id = row[idIdx] || '';
    if (!id) continue;
    const coords = OUTLET_COORDS[id] || ['-6.2741', '106.8006'];
    newRows.push([
      id,
      row[brandIdx] || 'BR-001',
      row[nameIdx] || '',
      row[codeIdx] || '',
      row[addrIdx] || '',
      coords[0],
      coords[1],
      '100',
      row[statusIdx] || 'active',
      row[createdIdx] || '',
      row[updatedIdx] || ''
    ]);
  }
  if (newRows.length) {
    await s.spreadsheets.values.update({
      spreadsheetId: sid,
      range: 'master_outlet!A2:K' + (newRows.length + 1),
      valueInputOption: 'RAW',
      requestBody: { values: newRows }
    });
    console.log('[outlet] fixed ' + newRows.length + ' rows with correct coords');
  }
}

async function fixShifts() {
  // Keep only the 4 correct rows; re-seed cleanly.
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const clean = [
    ['SH-001','Pagi','BR-001','OL-001','07:00','15:00','30','10','','active',now],
    ['SH-002','Siang','BR-001','OL-001','12:00','20:00','30','10','','active',now],
    ['SH-003','Split','BR-001','OL-001','10:00','14:00','0','10','','active',now],
    ['SH-004','Malam','BR-001','OL-001','20:00','04:00','30','10','','active',now]
  ];
  await s.spreadsheets.values.clear({ spreadsheetId: sid, range: 'master_shift!A2:K1000' });
  await s.spreadsheets.values.update({
    spreadsheetId: sid,
    range: 'master_shift!A2:K5',
    valueInputOption: 'RAW',
    requestBody: { values: clean }
  });
  console.log('[shift] cleared corrupt rows, re-seeded 4 clean shifts');
}

async function setTelegramId() {
  const r = await s.spreadsheets.values.get({ spreadsheetId: sid, range: 'master_employee!A1:AH50' });
  const rows = r.data.values || [];
  const header = rows[0] || [];
  const idIdx = header.indexOf('employee_id');
  const tgIdx = header.indexOf('telegram_id');
  if (tgIdx < 0) { console.log('[telegram] no telegram_id column'); return; }
  const tgCol = colLetter(tgIdx + 1);
  let done = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    if (row[idIdx] === 'EMP-001') {
      await s.spreadsheets.values.update({
        spreadsheetId: sid,
        range: 'master_employee!' + tgCol + (i + 1),
        valueInputOption: 'RAW',
        requestBody: { values: [['5721500978']] }
      });
      console.log('[telegram] EMP-001 telegram_id -> 5721500978 (row ' + (i + 1) + ')');
      done++;
    }
  }
  if (!done) console.log('[telegram] EMP-001 not found');
}

async function main() {
  await rewriteHeader('master_employee', HEADERS.master_employee);
  await rewriteHeader('master_outlet', HEADERS.master_outlet);
  await rewriteHeader('master_shift', HEADERS.master_shift);
  await rewriteHeader('users', HEADERS.users);
  await fixOutlets();
  await fixShifts();
  await setTelegramId();
  console.log('DONE');
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
"""

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-hr-v1/fix_sheets.js', 'w') as f:
    f.write(NODE_SCRIPT)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; cd /home/dev/ykp/ykp-hr-v1 && node fix_sheets.js"
stdin, stdout, stderr = ssh.exec_command(cmd)
print('STDOUT:\n' + stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:\n' + err)
ssh.close()
