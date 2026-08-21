"""After fixing master_outlet header, verify geofence radius is enforced:
  TEST 1: /masuk inside radius (exact center) -> row added, INSIDE_RADIUS
  TEST 2: /masuk outside radius (~455m) -> rejected, no row added
Between tests, clear the today row so the idempotent guard doesn't block.
"""
import paramiko, json, time
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timezone, timedelta

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"
PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"
SECRET = "1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52"
CHAT_ID = 5721500978
WIB = timezone(timedelta(hours=7))
TODAY = datetime.now(WIB).strftime("%Y-%m-%d")


def col_letter(idx):  # 1-based
    s = ""
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        s = chr(ord('A') + rem) + s
    return s


def get_creds_sid():
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
    }, scopes=["https://www.googleapis.com/auth/spreadsheets"])
    return creds, vals["YKP_HR_SPREADSHEET_ID"]


creds, sid = get_creds_sid()
svc = build("sheets", "v4", credentials=creds)


def read_att():
    res = svc.spreadsheets().values().get(spreadsheetId=sid, range="hr_attendance!A1:AN2000").execute()
    rows = res.get("values", [])
    data = [r for r in rows[1:] if r and len(r) > 0 and r[0].strip()]
    return [rows[0]] + data


def emp001_today():
    rows = read_att()
    h = rows[0]
    eid = h.index("employee_id")
    dt = h.index("date")
    return [r for r in rows[1:] if len(r) > eid and r[eid] == "EMP-001" and len(r) > dt and r[dt] == TODAY]


def clear_today():
    rows = read_att()
    h = rows[0]
    eid = h.index("employee_id")
    dt = h.index("date")
    n = len(h)
    last = col_letter(n)
    for i, r in enumerate(rows[1:], start=2):
        if len(r) > eid and r[eid] == "EMP-001" and len(r) > dt and r[dt] == TODAY:
            svc.spreadsheets().values().clear(spreadsheetId=sid, range=f"hr_attendance!A{i}:{last}{i}", body={}).execute()
            print(f"  cleared row {i}")


def send(text, location):
    body = {"message": {"chat": {"id": CHAT_ID}, "text": text, "location": location}}
    payload = json.dumps(body)
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=30)
    cmd = (f"export PATH={PATH}; cat > /tmp/wbg.json <<'EOF'\n{payload}\nEOF\n"
           f"curl -s -w '\\nHTTP=%{{http_code}}\\n' -X POST "
           f"http://localhost:3008/api/hr/attendance/telegram "
           f"-H 'Content-Type: application/json' "
           f"-H 'x-telegram-bot-api-secret-token: {SECRET}' "
           f"--data-binary @/tmp/wbg.json")
    stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
    out = stdout.read().decode("utf-8", "replace")
    c.close()
    return out


clear_today()
print(f"[BEFORE] EMP-001 today: {len(emp001_today())}")

print("\n--- TEST 1: /masuk INSIDE radius (center -6.2741,106.8006) ---")
print(send("/masuk", {"latitude": -6.2741, "longitude": 106.8006}))
time.sleep(3)
r1 = emp001_today()
h = read_att()[0]
if r1:
    last = r1[-1]
    loc = last[h.index("check_in_location")]
    st = last[h.index("attendance_status")]
    print(f"  row added: check_in_location={loc!r} status={st!r}")
    inside_ok = loc == "INSIDE_RADIUS"
else:
    inside_ok = False
    print("  [FAIL] no row added")

clear_today()
print("\n--- TEST 2: /masuk OUTSIDE radius (-6.2700,106.8006 ~455m) ---")
print(send("/masuk", {"latitude": -6.2700, "longitude": 106.8006}))
time.sleep(3)
r2 = emp001_today()
print(f"  EMP-001 today: {len(r2)}")
outside_ok = len(r2) == 0
if outside_ok:
    print("  [OK] rejected — no row added (radius enforced)")
else:
    print(f"  [FAIL] row added despite outside radius: {r2[-1][:6] if r2 else ''}")

clear_today()
print(f"\n[AFTER] EMP-001 today (cleaned): {len(emp001_today())}")
print(f"\ninside-radius: {'OK' if inside_ok else 'FAIL'} | outside-radius rejection: {'OK' if outside_ok else 'FAIL'}")
print("VERIFIED geofence enforced" if inside_ok and outside_ok else "PARTIAL — see failures")