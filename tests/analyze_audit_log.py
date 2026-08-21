"""Analyze audit_log live data to understand the actual layout(s) present.
Some rows may already use the new layout (with chain_hash), others the old.
We need to detect which is which and only migrate the old-layout rows."""
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

# Read all audit_log data (up to 2000 rows, full width AN=40)
res = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="audit_log!A1:N2000").execute()
rows = res.get("values", [])
header = rows[0]
print(f"header ({len(header)}): {header}")
data = [r for r in rows[1:] if r and any(v.strip() for v in r if isinstance(v, str))]
print(f"non-empty data rows: {len(data)}")
print(f"\nfirst 5 rows:")
for r in data[:5]:
    print(f"  ({len(r)}): {r}")
print(f"\nlast 5 rows:")
for r in data[-5:]:
    print(f"  ({len(r)}): {r}")

# Analyze: how many cols does each row have?
from collections import Counter
counts = Counter(len(r) for r in data)
print(f"\nrow length distribution: {dict(counts)}")

# Check if col 1 (header 'module') looks like a timestamp or a user id
# Old layout: idx1 = actor user. New layout: idx1 = timestamp.
ts_like = 0
uid_like = 0
for r in data:
    v = r[1] if len(r) > 1 else ""
    if v and v[0:4].isdigit() and "-" in v:
        ts_like += 1
    else:
        uid_like += 1
print(f"\nidx1 looks like timestamp: {ts_like}, looks like user id: {uid_like}")