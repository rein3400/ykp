"""Fix the master_employee header row (row 1) to match TAB_HEADERS.employees.

The data rows already follow the TAB_HEADERS layout (telegram_id at index 7),
but the header row still uses the old layout (created_at at index 7, no
telegram_id). This overwrites A1:Z1 with the correct header so readTab maps
telegram_id correctly and findEmployeeByTelegramId resolves chat ids.

Only row 1 is written — no data rows are touched.
"""
import paramiko
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
sftp = c.open_sftp()
with sftp.open("/home/dev/ykp/ykp-hr-v1/.env", "r") as f:
    env = f.read().decode("utf-8", "replace")
sftp.close()
c.close()
EQ = chr(61)
vals = {}
for line in env.splitlines():
    if EQ in line and not line.strip().startswith("#"):
        k, _, v = line.partition(EQ)
        vals[k.strip()] = v.strip().strip("'").strip('"')

# Read-write scope to update the header.
creds = Credentials.from_service_account_info({
    "client_email": vals["GOOGLE_SERVICE_ACCOUNT_EMAIL"],
    "private_key": vals["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"].replace("\\n", "\n"),
    "type": "service_account",
    "token_uri": "https://oauth2.googleapis.com/token",
}, scopes=["https://www.googleapis.com/auth/spreadsheets"])
svc = build("sheets", "v4", credentials=creds)
SPREAD = vals["YKP_HR_SPREADSHEET_ID"]

EXPECTED = [
    'employee_id', 'employee_code', 'full_name', 'nickname', 'gender',
    'phone', 'email', 'telegram_id', 'address', 'date_of_birth',
    'join_date', 'employment_status', 'contract_type', 'department', 'role',
    'position', 'brand_id', 'outlet_id', 'supervisor_id', 'basic_salary',
    'salary_type', 'bank_name', 'bank_account', 'account_holder',
    'bpjs_status', 'tax_status'
]

# Read current header to show before
res = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="master_employee!A1:Z1").execute()
before = res.get("values", [[""]])[0]
print("BEFORE:", before)

# Update header row only
body = {"values": [EXPECTED]}
res2 = svc.spreadsheets().values().update(
    spreadsheetId=SPREAD,
    range="master_employee!A1:Z1",
    valueInputOption="RAW",
    body=body,
).execute()
print("updated:", res2.get("updatedCells"), "cells")

# Verify
res3 = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="master_employee!A1:Z1").execute()
after = res3.get("values", [[""]])[0]
print("AFTER:", after)

# Verify EMP-001 telegram_id now resolves
res4 = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="master_employee!A2:Z2").execute()
emp = res4.get("values", [[""]])[0]
print("EMP-001 row:", emp)
print(f"telegram_id (idx 7): {emp[7]!r}")