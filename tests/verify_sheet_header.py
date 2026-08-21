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

r = svc.spreadsheets().values().get(spreadsheetId=sid, range="telegram_link_codes!A1:H1").execute()
print("header row:", r.get('values'))
