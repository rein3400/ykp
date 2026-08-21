"""Confirm the header fix makes readTab resolve outlet.latitude/longitude
correctly by reading master_outlet as readTab does (map to header row)."""
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

# Read master_outlet the same way readTab does: A1:K{N}
res = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="master_outlet!A1:K100").execute()
rows = res.get("values", [])
header = rows[0]
print(f"header: {header}")
# map each row like readTab
for r in rows[1:5]:
    obj = {}
    for i, h in enumerate(header):
        obj[h] = r[i] if i < len(r) else ""
    print(f"\n{obj.get('outlet_id')}: latitude={obj.get('latitude')!r} longitude={obj.get('longitude')!r} radius={obj.get('attendance_radius_m')!r}")

# Also test: simulate classifyLocation with outside point
import math
def dist_m(a, b):
    R = 6371000
    toRad = lambda d: d * math.pi / 180
    dLat = toRad(b[0] - a[0])
    dLon = toRad(b[1] - a[1])
    h = math.sin(dLat/2)**2 + math.cos(toRad(a[0]))*math.cos(toRad(b[0]))*math.sin(dLon/2)**2
    return 2 * R * math.asin(math.sqrt(h))

for r in rows[1:3]:
    obj = {}
    for i, h in enumerate(header):
        obj[h] = r[i] if i < len(r) else ""
    olat = float(obj.get("latitude", 0))
    olon = float(obj.get("longitude", 0))
    radius = float(obj.get("attendance_radius_m", 0))
    # outside test point
    test = (-6.2700, 106.8006)
    d = dist_m(test, (olat, olon))
    print(f"{obj.get('outlet_id')}: outlet=({olat},{olon}) r={radius}m; test point {test} -> {d:.0f}m -> {'OUTSIDE' if d > radius else 'INSIDE'}")