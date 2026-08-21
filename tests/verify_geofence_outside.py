"""Verify outside-radius rejection by DELETING the today row (not just
clearing values) so the idempotent guard does not fire, then sending /masuk
from outside the radius. Uses batchUpdate deleteDimension to remove the row
entirely."""
import paramiko, json, time
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timezone, timedelta

HOST = "187.77.114.168"
PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"
SECRET = "1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52"
CHAT_ID = 5721500978
WIB = timezone(timedelta(hours=7))
TODAY = datetime.now(WIB).strftime("%Y-%m-%d")


def col_letter(idx):
    s = ""
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        s = chr(ord('A') + rem) + s
    return s


def get_creds_sid():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="dev", password="password", timeout=30)
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
    return creds, vals["YKP_HR_SPREADSHEET_ID"]


creds, sid = get_creds_sid()
svc = build("sheets", "v4", credentials=creds)


def read_att():
    res = svc.spreadsheets().values().get(spreadsheetId=sid, range="hr_attendance!A1:AN2000").execute()
    rows = res.get("values", [])
    data = [r for r in rows[1:] if r and len(r) > 0 and r[0].strip()]
    return [rows[0]] + data


def emp001_today_rows():
    rows = read_att()
    h = rows[0]
    eid = h.index("employee_id")
    dt = h.index("date")
    return [(i + 2, r) for i, r in enumerate(rows[1:]) if r and len(r) > eid and r[eid] == "EMP-001" and len(r) > dt and r[dt] == TODAY]


def delete_rows(row_nums):
    """Delete entire rows by row number (1-based) using batchUpdate."""
    if not row_nums:
        return
    # Delete from highest to lowest so indices don't shift
    for rn in sorted(row_nums, reverse=True):
        req = {"deleteDimension": {"range": {"sheetId": None, "dimension": "ROWS", "startIndex": rn - 1, "endIndex": rn}}}
        # need sheetId — get from metadata
        meta = svc.spreadsheets().get(spreadsheetId=sid).execute()
        for s in meta.get("sheets", []):
            if s.get("properties", {}).get("title") == "hr_attendance":
                req["deleteDimension"]["range"]["sheetId"] = s.get("properties", {}).get("sheetId")
        svc.spreadsheets().batchUpdate(spreadsheetId=sid, body={"requests": [req]}).execute()
        print(f"  deleted sheet row {rn}")


def send(text, location):
    body = {"message": {"chat": {"id": CHAT_ID}, "text": text, "location": location}}
    payload = json.dumps(body)
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="dev", password="password", timeout=30)
    cmd = (f"export PATH={PATH}; cat > /tmp/wbo.json <<'EOF'\n{payload}\nEOF\n"
           f"curl -s -w '\\nHTTP=%{{http_code}}\\n' -X POST "
           f"http://localhost:3008/api/hr/attendance/telegram "
           f"-H 'Content-Type: application/json' "
           f"-H 'x-telegram-bot-api-secret-token: {SECRET}' "
           f"--data-binary @/tmp/wbo.json")
    stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
    out = stdout.read().decode("utf-8", "replace")
    c.close()
    return out


# Delete any EMP-001 today rows first (clean slate)
rows = emp001_today_rows()
print(f"[BEFORE] EMP-001 today rows: {len(rows)}")
delete_rows([rn for rn, _ in rows])
time.sleep(2)
print(f"[AFTER DELETE] EMP-001 today rows: {len(emp001_today_rows())}")

# Test: /masuk OUTSIDE radius (~455m from center)
print("\n--- /masuk OUTSIDE radius (-6.2700, 106.8006 ~455m from center) ---")
print(send("/masuk", {"latitude": -6.2700, "longitude": 106.8006}))
time.sleep(3)
after = emp001_today_rows()
print(f"[AFTER] EMP-001 today rows: {len(after)}")
if len(after) == 0:
    print("[OK] REJECTED — outside radius, no row added. Geofence enforced.")
else:
    h = read_att()[0]
    last = after[-1][1]
    loc = last[h.index("check_in_location")]
    print(f"[FAIL] row added: check_in_location={loc!r} — geofence NOT enforced")

# cleanup
delete_rows([rn for rn, _ in after])
print(f"[CLEANED] EMP-001 today rows: {len(emp001_today_rows())}")