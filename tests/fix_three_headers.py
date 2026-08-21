"""Fix header row (row 1) for 3 safe tabs: master_outlet, master_shift,
hr_attendance. Data rows already follow the new TAB_HEADERS layout; only the
header row is stale. Overwrite A1:<lastCol>1 with the expected headers.

audit_log is SKIPPED — its data rows follow the OLD layout, not TAB_HEADERS;
overwriting the header would corrupt the mapping. hr_payroll header is already
correct (38 cols) — no fix needed.
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
creds = Credentials.from_service_account_info({
    "client_email": vals["GOOGLE_SERVICE_ACCOUNT_EMAIL"],
    "private_key": vals["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"].replace("\\n", "\n"),
    "type": "service_account",
    "token_uri": "https://oauth2.googleapis.com/token",
}, scopes=["https://www.googleapis.com/auth/spreadsheets"])
svc = build("sheets", "v4", credentials=creds)
SPREAD = vals["YKP_HR_SPREADSHEET_ID"]

FIXES = {
    'master_outlet': ['outlet_id', 'brand_id', 'outlet_name', 'outlet_code', 'address', 'latitude', 'longitude', 'attendance_radius_m', 'status', 'created_at', 'updated_at'],
    'master_shift': ['shift_id', 'shift_name', 'brand_id', 'outlet_id', 'start_time', 'end_time', 'break_minutes', 'late_tolerance_minutes', 'overtime_rule_id', 'active_status', 'created_at'],
    'hr_attendance': ['attendance_id', 'date', 'employee_id', 'employee_name', 'brand_id', 'outlet_id', 'shift_id', 'scheduled_check_in', 'actual_check_in', 'scheduled_check_out', 'actual_check_out', 'check_in_location', 'check_out_location', 'latitude', 'longitude', 'attendance_radius_m', 'check_in_photo_url', 'check_out_photo_url', 'attendance_status', 'late_minutes', 'early_leave_minutes', 'overtime_minutes', 'correction_id', 'correction_status', 'correction_type', 'correction_reason', 'corrected_clock_in', 'corrected_clock_out', 'corrected_status', 'correction_photo_url', 'correction_latitude', 'correction_longitude', 'correction_requested_by', 'correction_requested_at', 'correction_approved_by', 'correction_approved_at', 'approved_by', 'notes', 'created_at', 'updated_at'],
}

for tab, expected in FIXES.items():
    n = len(expected)
    # column letter for last col (1-based -> A, B, ..., Z, AA, AB, ...)
    def col_letter(idx):  # idx is 1-based
        s = ""
        while idx > 0:
            idx, rem = divmod(idx - 1, 26)
            s = chr(ord('A') + rem) + s
        return s
    last = col_letter(n)
    rng = f"{tab}!A1:{last}1"
    # read before
    res = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range=rng).execute()
    before = res.get("values", [[""]])[0]
    print(f"\n=== {tab} ({n} cols, range {rng}) ===")
    print(f"BEFORE: {before}")
    body = {"values": [expected]}
    svc.spreadsheets().values().update(
        spreadsheetId=SPREAD, range=rng, valueInputOption="RAW", body=body
    ).execute()
    res2 = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range=rng).execute()
    after = res2.get("values", [[""]])[0]
    print(f"AFTER : {after}")
    print("MATCH" if after == expected else "STILL MISMATCH")