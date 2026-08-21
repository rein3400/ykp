"""Closer look at hr_payroll data layout vs expected TAB_HEADERS.
The first data row looked misaligned (index 1 = EMP-001 but expected
payroll_period). Confirm whether data follows a DIFFERENT layout than
TAB_HEADERS — if so, header overwrite would corrupt mapping."""
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
SPREAD = vals["YKP_HR_SPREADSHEET_ID"]

EXPECTED = ['payroll_id', 'payroll_period', 'employee_id', 'employee_name', 'brand_id', 'outlet_id', 'basic_salary', 'attendance_days', 'absent_days', 'paid_leave_days', 'unpaid_leave_days', 'late_minutes', 'attendance_deduction', 'overtime_hours', 'overtime_pay', 'bonus_total', 'penalty_total', 'allowance_total', 'cash_advance_deduction', 'bpjs_deduction', 'tax_deduction', 'other_deduction', 'gross_salary', 'net_salary', 'calculation_status', 'approval_status', 'payment_status', 'locked_status', 'locked_at', 'locked_by', 'unlock_reason', 'unlock_approved_by', 'payment_date', 'payment_reference', 'payslip_url', 'approved_by', 'created_at', 'updated_at']

# read live header + 3 data rows with ALL columns up to col AL (38)
res = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="hr_payroll!A1:AL4").execute()
rows = res.get("values", [])
live_header = rows[0]
print(f"live header ({len(live_header)}): {live_header}")
print(f"\nexpected ({len(EXPECTED)}): {EXPECTED}")
print("\n--- data rows with live header mapping ---")
for r in rows[1:]:
    print(f"row ({len(r)} values): {r}")
    print("  mapped via LIVE header:")
    for i, v in enumerate(r):
        h = live_header[i] if i < len(live_header) else f"<{i}>"
        print(f"    {h} = {v!r}")
    print("  mapped via EXPECTED header:")
    for i, v in enumerate(r):
        h = EXPECTED[i] if i < len(EXPECTED) else f"<{i}>"
        print(f"    {h} = {v!r}")
    print()