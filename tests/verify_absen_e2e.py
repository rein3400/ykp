"""End-to-end live verify: Telegram /masuk adds a new attendance row to the
HR Google Sheet, then /pulang fills the check-out.

Flow:
  1. Count hr_attendance rows + find EMP-001 rows today (expect 0)
  2. POST /masuk webhook with chat_id=5721500978 (EMP-001) + location
     (-6.2741, 106.8006 = exact OL-001 center, inside radius 100m)
  3. Wait 2s, re-count rows + find EMP-001 row today (expect 1 new row,
     attendance_status PRESENT or LATE, check_in_location INSIDE_RADIUS)
  4. POST /pulang webhook
  5. Wait 2s, re-read EMP-001 row today, assert actual_check_out is now set
"""
import paramiko, json, time, sys
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timezone, timedelta

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"
PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"
SECRET = "1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52"
CHAT_ID = 5721500978  # EMP-001 owner

WIB = timezone(timedelta(hours=7))
TODAY = datetime.now(WIB).strftime("%Y-%m-%d")


def get_creds_and_sid():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=30)
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
    return creds, vals["YKP_HR_SPREADSHEET_ID"]


def read_attendance(creds, sid):
    svc = build("sheets", "v4", credentials=creds)
    res = svc.spreadsheets().values().get(spreadsheetId=sid, range="hr_attendance!A1:AB2000").execute()
    rows = res.get("values", [])
    # count only non-empty data rows (attendance_id present in col 0)
    # Google Sheets API returns trailing empty rows within the range; those
    # are not real attendance rows and must not skew the count.
    data = [r for r in rows[1:] if r and len(r) > 0 and r[0].strip()]
    return [rows[0]] + data


def send_webhook(text, location=None):
    body = {"message": {"chat": {"id": CHAT_ID}, "text": text}}
    if location is not None:
        body["message"]["location"] = location
    payload = json.dumps(body)
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=30)
    cmd = (
        f"export PATH={PATH}; "
        f"cat > /tmp/wb_e2e.json <<'EOF'\n{payload}\nEOF\n"
        f"curl -s -w '\\nHTTP=%{{http_code}}\\n' -X POST "
        f"http://localhost:3008/api/hr/attendance/telegram "
        f"-H 'Content-Type: application/json' "
        f"-H 'x-telegram-bot-api-secret-token: {SECRET}' "
        f"--data-binary @/tmp/wb_e2e.json"
    )
    stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
    out = stdout.read().decode("utf-8", "replace")
    c.close()
    return out


def main():
    creds, sid = get_creds_and_sid()
    rows = read_attendance(creds, sid)
    total_before = len(rows) - 1
    # find EMP-001 rows today
    header = rows[0]
    eid_idx = header.index("employee_id")
    date_idx = header.index("date")
    emp001_today_before = [r for r in rows[1:] if len(r) > eid_idx and r[eid_idx] == "EMP-001" and len(r) > date_idx and r[date_idx] == TODAY]
    print(f"[BEFORE] total attendance rows: {total_before}")
    print(f"[BEFORE] EMP-001 rows today ({TODAY}): {len(emp001_today_before)}")

    print("\n--- STEP 1: POST /masuk with inside-radius location ---")
    out = send_webhook("/masuk", {"latitude": -6.2741, "longitude": 106.8006})
    print(out)

    time.sleep(3)
    rows_after = read_attendance(creds, sid)
    total_after = len(rows_after) - 1
    header_a = rows_after[0]
    eid_idx_a = header_a.index("employee_id")
    date_idx_a = header_a.index("date")
    emp001_today_after = [r for r in rows_after[1:] if len(r) > eid_idx_a and r[eid_idx_a] == "EMP-001" and len(r) > date_idx_a and r[date_idx_a] == TODAY]
    print(f"[AFTER MASUK] total rows: {total_after}")
    print(f"[AFTER MASUK] EMP-001 rows today: {len(emp001_today_after)}")

    ok = True
    if total_after != total_before + 1:
        print(f"[FAIL] expected total to increase by 1, got {total_after-total_before}")
        ok = False
    if len(emp001_today_after) != len(emp001_today_before) + 1:
        print(f"[FAIL] expected EMP-001 today rows to increase by 1, got {len(emp001_today_after)-len(emp001_today_before)}")
        ok = False
    else:
        new_row = emp001_today_after[-1]
        att_id_idx = header_a.index("attendance_id")
        check_in_idx = header_a.index("actual_check_in")
        loc_idx = header_a.index("check_in_location")
        status_idx = header_a.index("attendance_status")
        print(f"\n[NEW ROW] id={new_row[att_id_idx]}")
        print(f"  actual_check_in={new_row[check_in_idx] if len(new_row)>check_in_idx else ''}")
        print(f"  check_in_location={new_row[loc_idx] if len(new_row)>loc_idx else ''}")
        print(f"  attendance_status={new_row[status_idx] if len(new_row)>status_idx else ''}")
        loc_val = new_row[loc_idx] if len(new_row) > loc_idx else ""
        status_val = new_row[status_idx] if len(new_row) > status_idx else ""
        if loc_val != "INSIDE_RADIUS":
            print(f"[FAIL] expected check_in_location=INSIDE_RADIUS, got {loc_val!r}")
            ok = False
        if status_val not in ("PRESENT", "LATE"):
            print(f"[FAIL] expected status PRESENT/LATE, got {status_val!r}")
            ok = False
        if not (new_row[check_in_idx] if len(new_row) > check_in_idx else ""):
            print(f"[FAIL] actual_check_in is empty")
            ok = False

    print("\n--- STEP 2: POST /pulang ---")
    out = send_webhook("/pulang")
    print(out)

    time.sleep(3)
    rows_final = read_attendance(creds, sid)
    header_f = rows_final[0]
    eid_idx_f = header_f.index("employee_id")
    date_idx_f = header_f.index("date")
    emp001_final = [r for r in rows_final[1:] if len(r) > eid_idx_f and r[eid_idx_f] == "EMP-001" and len(r) > date_idx_f and r[date_idx_f] == TODAY]
    if not emp001_final:
        print("[FAIL] no EMP-001 row today after /pulang")
        sys.exit(2)
    last = emp001_final[-1]
    check_out_idx = header_f.index("actual_check_out")
    co_val = last[check_out_idx] if len(last) > check_out_idx else ""
    print(f"[AFTER PULANG] actual_check_out={co_val!r}")
    if not co_val:
        print("[FAIL] actual_check_out still empty after /pulang")
        ok = False
    else:
        print("[OK] actual_check_out filled")

    print("\n=== SUMMARY ===")
    print(f"rows before: {total_before}, after masuk: {total_after}, after pulang: {len(rows_final)-1}")
    print(f"EMP-001 today: before={len(emp001_today_before)} after_masuk={len(emp001_today_after)} after_pulang={len(emp001_final)}")
    if ok:
        print("\nVERIFIED: Telegram /masuk added a new attendance row (INSIDE_RADIUS, PRESENT/LATE), /pulang filled check-out.")
    else:
        print("\nFAILED: see [FAIL] lines above")
        sys.exit(2)


if __name__ == "__main__":
    main()