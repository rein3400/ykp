"""Compare the live master_employee header row against TAB_HEADERS.employees
(expected by the code) to find the column offset problem."""
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
creds = Credentials.from_service_account_info({
    "client_email": vals["GOOGLE_SERVICE_ACCOUNT_EMAIL"],
    "private_key": vals["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"].replace("\\n", "\n"),
    "type": "service_account",
    "token_uri": "https://oauth2.googleapis.com/token",
}, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
svc = build("sheets", "v4", credentials=creds)
res = svc.spreadsheets().values().get(spreadsheetId=vals["YKP_HR_SPREADSHEET_ID"], range="master_employee!A1:Z1").execute()
live = res.get("values", [[""]])[0]

EXPECTED = [
    'employee_id', 'employee_code', 'full_name', 'nickname', 'gender',
    'phone', 'email', 'telegram_id', 'address', 'date_of_birth',
    'join_date', 'employment_status', 'contract_type', 'department', 'role',
    'position', 'brand_id', 'outlet_id', 'supervisor_id', 'basic_salary',
    'salary_type', 'bank_name', 'bank_account', 'account_holder',
    'bpjs_status', 'tax_status'
]

print(f"expected ({len(EXPECTED)}): {EXPECTED}")
print(f"live    ({len(live)}): {live}")
print()
print(f"{'idx':>3}  {'expected':<20}  {'live':<20}  match")
for i in range(max(len(EXPECTED), len(live))):
    e = EXPECTED[i] if i < len(EXPECTED) else ""
    l = live[i] if i < len(live) else ""
    m = "OK" if e == l else "DIFF"
    print(f"{i:>3}  {e:<20}  {l:<20}  {m}")

# Also read EMP-001 data row to see where telegram_id value actually sits
res2 = svc.spreadsheets().values().get(spreadsheetId=vals["YKP_HR_SPREADSHEET_ID"], range="master_employee!A2:Z2").execute()
emp = res2.get("values", [[""]])[0]
print("\nEMP-001 data row:")
for i in range(len(emp)):
    print(f"  [{i}] {emp[i]!r}")