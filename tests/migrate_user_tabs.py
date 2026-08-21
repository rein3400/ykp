import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=30)
stdin, stdout, stderr = c.exec_command(
    "grep -E 'GOOGLE_SERVICE_ACCOUNT_EMAIL|GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY|YKP_HR_SPREADSHEET_ID' /home/dev/ykp/ykp-hr-v1/.env",
    timeout=30)
out = stdout.read().decode()
c.close()

env = {}
for line in out.splitlines():
    if '=' in line:
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

email = env['GOOGLE_SERVICE_ACCOUNT_EMAIL']
pk = env['GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'].replace('\\n', '\n')
sid = env['YKP_HR_SPREADSHEET_ID']

info = {
    "type": "service_account",
    "project_id": "ykp-hr-v1",
    "private_key_id": "x",
    "private_key": pk,
    "client_email": email,
    "client_id": "x",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{email}",
}
creds = service_account.Credentials.from_service_account_info(
    info, scopes=['https://www.googleapis.com/auth/spreadsheets'])
svc = build('sheets', 'v4', credentials=creds)

def migrate(tab, target_header, insert_after_idx):
    """Read all rows, insert empty columns to match target_header, write back."""
    r = svc.spreadsheets().values().get(spreadsheetId=sid, range=f"{tab}!A1:Z1000").execute()
    rows = r.get('values', [])
    if not rows:
        print(f"{tab}: empty, skip")
        return
    cur_header = rows[0]
    print(f"{tab} current header ({len(cur_header)}):", cur_header)
    if cur_header == target_header:
        print(f"{tab}: already correct")
        return
    # Build new rows: for each row, insert '' at insert positions
    new_rows = []
    for row in rows:
        new_row = list(row)
        # insert empty strings at the missing positions
        # We know target = cur with extra cols inserted at insert_after_idx
        # Simpler: rebuild by mapping. Compute missing cols.
        # Determine insertion: target_header has extra columns; find their indices.
        # We'll just pad/insert based on known target.
        new_rows.append(new_row)
    # Instead of generic, do explicit per-tab transform below.
    print(f"{tab}: needs explicit transform")

# Explicit transforms
def transform_investor(rows):
    # cur: [user_id, username, password_hash, role, investor_id, active_status, created_at, last_login_at]
    # target: [user_id, username, password_hash, role, investor_id, department, telegram_id, active_status, created_at, last_login_at]
    out = []
    for i, row in enumerate(rows):
        if i == 0:
            out.append(['user_id','username','password_hash','role','investor_id','department','telegram_id','active_status','created_at','last_login_at'])
        else:
            # pad row to 8
            r = row + [''] * (8 - len(row))
            out.append([r[0], r[1], r[2], r[3], r[4], '', '', r[5], r[6], r[7]])
    return out

def transform_ops(rows):
    # cur: [user_id, username, password_hash, role, brand_id, outlet_id, active_status, created_at, last_login_at]
    # target: [user_id, username, password_hash, role, brand_id, outlet_id, department, employee_id, telegram_id, active_status, created_at, last_login_at]
    out = []
    for i, row in enumerate(rows):
        if i == 0:
            out.append(['user_id','username','password_hash','role','brand_id','outlet_id','department','employee_id','telegram_id','active_status','created_at','last_login_at'])
        else:
            r = row + [''] * (9 - len(row))
            out.append([r[0], r[1], r[2], r[3], r[4], r[5], '', '', '', r[6], r[7], r[8]])
    return out

for tab, transform in [('investor_users', transform_investor), ('ops_users', transform_ops)]:
    r = svc.spreadsheets().values().get(spreadsheetId=sid, range=f"{tab}!A1:Z1000").execute()
    rows = r.get('values', [])
    if not rows:
        print(f"{tab}: empty, skip")
        continue
    print(f"{tab} current header:", rows[0])
    new_rows = transform(rows)
    # Clear and rewrite
    svc.spreadsheets().values().clear(spreadsheetId=sid, range=f"{tab}!A1:Z1000").execute()
    svc.spreadsheets().values().update(
        spreadsheetId=sid,
        range=f"{tab}!A1",
        valueInputOption='RAW',
        body={'values': new_rows}
    ).execute()
    print(f"{tab} migrated to header:", new_rows[0])

# Verify
for tab in ['investor_users', 'ops_users']:
    r = svc.spreadsheets().values().get(spreadsheetId=sid, range=f"{tab}!A1:Z1").execute()
    print(f"verify {tab}:", r.get('values', [[]])[0])
