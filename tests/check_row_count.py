"""Precisely count hr_attendance data rows after the /masuk test to understand
the +6 vs +1 discrepancy."""
import paramiko
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timezone, timedelta

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
creds = Credentials.from_service_account_info({
    "client_email": vals["GOOGLE_SERVICE_ACCOUNT_EMAIL"],
    "private_key": vals["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"].replace("\\n", "\n"),
    "type": "service_account",
    "token_uri": "https://oauth2.googleapis.com/token",
}, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
svc = build("sheets", "v4", credentials=creds)
SPREAD = vals["YKP_HR_SPREADSHEET_ID"]

WIB = timezone(timedelta(hours=7))
TODAY = datetime.now(WIB).strftime("%Y-%m-%d")

res = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="hr_attendance!A1:AB2000").execute()
rows = res.get("values", [])
print(f"raw rows returned: {len(rows)}")
# count non-empty data rows (col 0 attendance_id present)
data = [r for r in rows[1:] if r and len(r) > 0 and r[0].strip()]
print(f"non-empty data rows (attendance_id present): {len(data)}")
# last 8 rows
print("\nlast 8 raw rows:")
for r in rows[-8:]:
    print(f"  len={len(r)} {r[:4] if r else 'EMPTY'}")
# count today
header = rows[0]
date_idx = header.index("date")
eid_idx = header.index("employee_id")
today = [r for r in data if len(r) > date_idx and r[date_idx] == TODAY]
print(f"\nrows today ({TODAY}): {len(today)}")
for r in today:
    print(f"  {r[eid_idx]} {r[0]} {r[header.index('actual_check_in')] if len(r)>header.index('actual_check_in') else ''}")