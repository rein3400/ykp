"""For each mismatched tab, verify the DATA rows already follow the
TAB_HEADERS layout before we overwrite the header row. If a data row does
NOT match (e.g. values are in old positions), we skip and report — overwriting
the header would corrupt the mapping.

Tabs: master_outlet, master_shift, hr_attendance, hr_payroll, audit_log
For each:
  1. Read the data rows.
  2. Check key columns that differ between old and new layout to confirm
     the data follows the NEW layout (TAB_HEADERS).
  3. Report SAFE to fix header, or UNSAFE with the conflicting evidence.
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
}, scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"])
svc = build("sheets", "v4", credentials=creds)
SPREAD = vals["YKP_HR_SPREADSHEET_ID"]

EXPECTED = {
    'master_outlet': ['outlet_id', 'brand_id', 'outlet_name', 'outlet_code', 'address', 'latitude', 'longitude', 'attendance_radius_m', 'status', 'created_at', 'updated_at'],
    'master_shift': ['shift_id', 'shift_name', 'brand_id', 'outlet_id', 'start_time', 'end_time', 'break_minutes', 'late_tolerance_minutes', 'overtime_rule_id', 'active_status', 'created_at'],
    'hr_attendance': ['attendance_id', 'date', 'employee_id', 'employee_name', 'brand_id', 'outlet_id', 'shift_id', 'scheduled_check_in', 'actual_check_in', 'scheduled_check_out', 'actual_check_out', 'check_in_location', 'check_out_location', 'latitude', 'longitude', 'attendance_radius_m', 'check_in_photo_url', 'check_out_photo_url', 'attendance_status', 'late_minutes', 'early_leave_minutes', 'overtime_minutes', 'correction_id', 'correction_status', 'correction_type', 'correction_reason', 'corrected_clock_in', 'corrected_clock_out', 'corrected_status', 'correction_photo_url', 'correction_latitude', 'correction_longitude', 'correction_requested_by', 'correction_requested_at', 'correction_approved_by', 'correction_approved_at', 'approved_by', 'notes', 'created_at', 'updated_at'],
    'hr_payroll': ['payroll_id', 'payroll_period', 'employee_id', 'employee_name', 'brand_id', 'outlet_id', 'basic_salary', 'attendance_days', 'absent_days', 'paid_leave_days', 'unpaid_leave_days', 'late_minutes', 'attendance_deduction', 'overtime_hours', 'overtime_pay', 'bonus_total', 'penalty_total', 'allowance_total', 'cash_advance_deduction', 'bpjs_deduction', 'tax_deduction', 'other_deduction', 'gross_salary', 'net_salary', 'calculation_status', 'approval_status', 'payment_status', 'locked_status', 'locked_at', 'locked_by', 'unlock_reason', 'unlock_approved_by', 'payment_date', 'payment_reference', 'payslip_url', 'approved_by', 'created_at', 'updated_at'],
    'audit_log': ['audit_id', 'timestamp', 'actor_user_id', 'actor_role', 'action', 'entity', 'entity_id', 'before_value', 'after_value', 'reason', 'ip_address'],
}


def read_tab(tab, nrows=5):
    res = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range=f"{tab}!A1:Z{nrows+1}").execute()
    return res.get("values", [])


for tab, expected in EXPECTED.items():
    print(f"\n===== {tab} =====")
    rows = read_tab(tab, 5)
    if not rows:
        print("  EMPTY — no data, safe to overwrite header (no data to corrupt)")
        continue
    live_header = rows[0]
    data_rows = rows[1:]
    print(f"  expected ({len(expected)} cols): {expected}")
    print(f"  live header ({len(live_header)} cols): {live_header}")
    # Heuristic: check a few key columns that differ between old/new layout
    # to confirm the data follows the NEW layout.
    safe = True
    evidence = []
    if tab == 'master_outlet':
        # new layout: index 5 = latitude (numeric like -6.x), 6 = longitude, 7 = radius (100)
        for i, r in enumerate(data_rows):
            v5 = r[5] if len(r) > 5 else ""
            v6 = r[6] if len(r) > 6 else ""
            v7 = r[7] if len(r) > 7 else ""
            # latitude should be numeric like -6.2741
            try:
                float(v5)
                is_lat = -90 <= float(v5) <= 90
            except (ValueError, TypeError):
                is_lat = False
            if not is_lat:
                safe = False
                evidence.append(f"row {i+2} idx5={v5!r} (not latitude)")
                break
    elif tab == 'master_shift':
        # new: index 2 = brand_id (BR-xxx), 3 = outlet_id (OL-xxx)
        for i, r in enumerate(data_rows):
            v2 = r[2] if len(r) > 2 else ""
            v3 = r[3] if len(r) > 3 else ""
            if not v2.startswith("BR-"):
                safe = False
                evidence.append(f"row {i+2} idx2={v2!r} (not brand_id BR-xxx)")
                break
            if not v3.startswith("OL-"):
                safe = False
                evidence.append(f"row {i+2} idx3={v3!r} (not outlet_id OL-xxx)")
                break
    elif tab == 'hr_attendance':
        # new: index 13 = latitude, 14 = longitude (numeric), 18 = attendance_status (PRESENT/etc)
        for i, r in enumerate(data_rows):
            v13 = r[13] if len(r) > 13 else ""
            v18 = r[18] if len(r) > 18 else ""
            try:
                float(v13)
            except (ValueError, TypeError):
                # might be empty for ABSENT rows — check status
                if v18 not in ("ABSENT",):
                    safe = False
                    evidence.append(f"row {i+2} idx13={v13!r} (not latitude, status={v18!r})")
                    break
    elif tab == 'hr_payroll':
        # new: index 7 = attendance_days (numeric), 23 = net_salary (numeric)
        for i, r in enumerate(data_rows):
            v7 = r[7] if len(r) > 7 else ""
            try:
                float(v7)
            except (ValueError, TypeError):
                safe = False
                evidence.append(f"row {i+2} idx7={v7!r} (not attendance_days number)")
                break
    elif tab == 'audit_log':
        # new: index 1 = timestamp (YYYY-MM-DD...), 2 = actor_user_id (USR-xxx)
        for i, r in enumerate(data_rows):
            v1 = r[1] if len(r) > 1 else ""
            v2 = r[2] if len(r) > 2 else ""
            # timestamp should start with a digit (year)
            if not (v1 and v1[0].isdigit()):
                safe = False
                evidence.append(f"row {i+2} idx1={v1!r} (not timestamp)")
                break
    print(f"  SAFE: {safe}")
    if evidence:
        for e in evidence:
            print(f"    {e}")
    # print first 2 data rows for visual confirmation
    for r in data_rows[:2]:
        print(f"  data: {r}")