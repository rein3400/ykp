import json, time, urllib.request
from google.oauth2 import service_account
from googleapiclient.discovery import build
import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"
BOT_SECRET = "1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52"
CONSUME_URL = "https://hr-v1.oseedigital.tech/api/hr/telegram/link/consume"

# --- fetch creds ---
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

def read_tab(tab):
    r = svc.spreadsheets().values().get(spreadsheetId=sid, range=f"{tab}!A1:Z1000").execute()
    return r.get('values', [])

def write_tab(tab, rows):
    svc.spreadsheets().values().clear(spreadsheetId=sid, range=f"{tab}!A1:Z1000").execute()
    svc.spreadsheets().values().update(
        spreadsheetId=sid, range=f"{tab}!A1", valueInputOption='RAW',
        body={'values': rows}).execute()

def append_link_code(code, user_id, division):
    svc.spreadsheets().values().append(
        spreadsheetId=sid, range="telegram_link_codes!A1",
        valueInputOption='RAW', insertDataOption='INSERT_ROWS',
        body={'values': [[code, user_id, str(int(time.time()*1000)+600000), '', '', '', division]]}
    ).execute()

def post_consume(code, chat_id):
    body = json.dumps({"code": code, "telegram_chat_id": chat_id}).encode()
    req = urllib.request.Request(CONSUME_URL, data=body, method='POST', headers={
        'Content-Type': 'application/json',
        'x-bot-secret': BOT_SECRET,
    })
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# Test cases: (division, user_id, user_tab, telegram_id_col_idx)
# users tab header: user_id(0) username(1) password_hash(2) role(3) brand_id(4) outlet_id(5) department(6) employee_id(7) telegram_id(8) ...
# investor_users: user_id(0) username(1) password_hash(2) role(3) investor_id(4) department(5) telegram_id(6) active_status(7) ...
# ops_users: user_id(0) username(1) password_hash(2) role(3) brand_id(4) outlet_id(5) department(6) employee_id(7) telegram_id(8) ...

tests = [
    ("finance", "U-EMP-1", "users", 8),
    ("investor", "USR-INV-002", "investor_users", 6),
    ("ops", "USR-001", "ops_users", 8),
]

TEST_CHAT = "111111111"

for division, user_id, tab, tg_col in tests:
    print(f"\n===== TEST {division} (user {user_id}) =====")
    # snapshot current telegram_id
    rows = read_tab(tab)
    header = rows[0]
    target_row = None
    for r in rows[1:]:
        if r[0] == user_id:
            target_row = r
            break
    if target_row is None:
        print(f"  SKIP: user {user_id} not found in {tab}")
        continue
    orig_tg = target_row[tg_col] if tg_col < len(target_row) else ''
    print(f"  original telegram_id: {orig_tg!r}")

    code = f"T{division[:3].upper()}{int(time.time())%1000}"[:6].upper()
    # ensure 6 chars alnum
    code = ''.join(ch for ch in code if ch.isalnum())[:6]
    while len(code) < 6:
        code += 'X'
    print(f"  test code: {code}")

    append_link_code(code, user_id, division)
    status, body = post_consume(code, TEST_CHAT)
    print(f"  consume status: {status}, body: {body}")

    # verify telegram_id updated
    rows = read_tab(tab)
    for r in rows[1:]:
        if r[0] == user_id:
            new_tg = r[tg_col] if tg_col < len(r) else ''
            print(f"  new telegram_id: {new_tg!r}")
            ok = (new_tg == TEST_CHAT)
            print(f"  RESULT: {'PASS' if ok else 'FAIL'}")
            # revert
            r[tg_col] = orig_tg
            break
    write_tab(tab, rows)
    print(f"  reverted telegram_id to {orig_tg!r}")

print("\nDONE")
