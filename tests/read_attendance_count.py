"""Read the HR spreadsheet hr_attendance tab to count rows and find an employee
who has NOT clocked in today (so a /masuk webhook will append a NEW row)."""
import os, sys, json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# Read service account creds from the HR V1 .env.local on the VPS? No — we
# have the spreadsheet id from AGENTS.md; but we need the service account key.
# The key lives on the VPS in /home/dev/ykp/ykp-hr-v1/.env. Read it via SSH.
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
sftp = c.open_sftp()
with sftp.open("/home/dev/ykp/ykp-hr-v1/.env", "r") as f:
    env = f.read().decode("utf-8", "replace")
sftp.close()
c.close()

# parse env
vals = {}
for line in env.splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, _, v = line.partition("=")
        vals[k.strip()] = v.strip().strip("'\"")

email = vals.get("GOOGLE_SERVICE_ACCOUNT_EMAIL", "")
pkey = vals.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "").replace("\\n", "\n")
sid = vals.get("YKP_HR_SPREADSHEET_ID", "")
print(f"email={email}")
print(f"sid={sid}")
print(f"pkey_len={len(pkey)}")

creds = Credentials.from_service_account_info({
    "client_email": email,
    "private_key": pkey,
    "type": "service_account",
    "token_uri": "https://oauth2.googleapis.com/token",
}, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
svc = build("sheets", "v4", credentials=creds)

# Read hr_attendance + master_employee tabs
SPREAD = sid
res = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="hr_attendance!A1:Z2000").execute()
rows = res.get("values", [])
header = rows[0] if rows else []
print(f"\nhr_attendance rows: {len(rows)-1}")
# find today's date in WIB
from datetime import datetime, timezone, timedelta
WIB = timezone(timedelta(hours=7))
today = datetime.now(WIB).strftime("%Y-%m-%d")
print(f"today (WIB)={today}")
# columns: find date col
date_idx = header.index("date") if "date" in header else 0
emp_idx = header.index("employee_id") if "employee_id" in header else None
att_idx = header.index("attendance_id") if "attendance_id" in header else None
print(f"header: {header[:12]}")
today_rows = [r for r in rows[1:] if len(r) > date_idx and r[date_idx] == today]
print(f"attendance rows today: {len(today_rows)}")
for r in today_rows[:20]:
    eid = r[emp_idx] if emp_idx is not None and len(r) > emp_idx else "?"
    aid = r[att_idx] if att_idx is not None and len(r) > att_idx else "?"
    print(f"  {aid}  {eid}")

# Read master_employee
res2 = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="master_employee!A1:Z2000").execute()
erows = res2.get("values", [])
eh = erows[0] if erows else []
print(f"\nmaster_employee rows: {len(erows)-1}")
tg_idx = eh.index("telegram_id") if "telegram_id" in eh else None
eemp_idx = eh.index("employee_id") if "employee_id" in eh else None
ename_idx = eh.index("full_name") if "full_name" in eh else None
print(f"emp header: {eh[:10]}")

# employees who have NOT clocked in today
today_emps = set()
for r in today_rows:
    if emp_idx is not None and len(r) > emp_idx:
        today_emps.add(r[emp_idx])

print("\nemployees linked to telegram who have NOT clocked in today:")
for r in erows[1:]:
    tg = r[tg_idx].strip() if tg_idx is not None and len(r) > tg_idx and r[tg_idx] else ""
    eid = r[eemp_idx] if eemp_idx is not None and len(r) > eemp_idx else ""
    name = r[ename_idx] if ename_idx is not None and len(r) > ename_idx else ""
    if tg and eid not in today_emps:
        print(f"  chat_id={tg}  {eid}  {name}")