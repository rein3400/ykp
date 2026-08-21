import json, os
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Use HR service account creds from local env if available, else read from VPS .env
# Simpler: read the spreadsheet via the same service account the apps use.
# We'll fetch creds from the VPS .env via paramiko, then query Sheets locally.
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

email = env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
pk = env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', '').replace('\\n', '\n')
sid = env.get('YKP_HR_SPREADSHEET_ID')

print("email:", email)
print("spreadsheet:", sid)
print("pk len:", len(pk))

info = json.loads(json.dumps({
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
}))

creds = service_account.Credentials.from_service_account_info(
    info, scopes=['https://www.googleapis.com/auth/spreadsheets'])
svc = build('sheets', 'v4', credentials=creds)

meta = svc.spreadsheets().get(spreadsheetId=sid).execute()
print("\n=== TABS ===")
for s in meta['sheets']:
    t = s['properties']['title']
    grid = s['properties'].get('gridProperties', {})
    print(f"{t}: rows={grid.get('rowCount')}, cols={grid.get('columnCount')}")

# Count data rows in users-like tabs
for tab in ['users', 'investor_users', 'ops_users', 'telegram_link_codes']:
    try:
        r = svc.spreadsheets().values().get(spreadsheetId=sid, range=f"'{tab}'!A1:A").execute()
        vals = r.get('values', [])
        print(f"\n{tab}: {len(vals)} rows total (incl header)")
        if len(vals) > 1:
            print("  header:", vals[0])
            for row in vals[1:6]:
                print("  ", row)
    except Exception as e:
        print(f"\n{tab}: ERROR {e}")
