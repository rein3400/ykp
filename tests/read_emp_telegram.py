"""Read full master_employee header + all columns to find telegram_id column,
then list employees with their telegram_id and whether they have clocked in today.
Avoids literal '=' in source to dodge PowerShell quoting mangling."""
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

res = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="master_employee!A1:Z2000").execute()
rows = res.get("values", [])
header = rows[0] if rows else []
print(f"master_employee full header ({len(header)} cols):")
for i, h in enumerate(header):
    print(f"  [{i}] {h!r}")

tg_idx = None
for i, h in enumerate(header):
    if h and h.strip().lower() in ("telegram_id", "telegram chat id", "telegram_chat_id"):
        tg_idx = i
        break
print(f"telegram_id column index: {tg_idx}")

print("\nAll employees (row by row):")
for r in rows[1:]:
    print(f"  {r}")

WIB = timezone(timedelta(hours=7))
today = datetime.now(WIB).strftime("%Y-%m-%d")
res2 = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="hr_attendance!A1:Z2000").execute()
arows = res2.get("values", [])
aheader = arows[0] if arows else []
date_idx = aheader.index("date") if "date" in aheader else 1
emp_idx = aheader.index("employee_id") if "employee_id" in aheader else 2
today_rows = [r for r in arows[1:] if len(r) > date_idx and r[date_idx] == today]
print(f"\nattendance rows today ({today}): {len(today_rows)}")
print(f"total attendance rows: {len(arows)-1}")
for r in today_rows:
    print(f"  {r[emp_idx] if len(r)>emp_idx else '?'}")