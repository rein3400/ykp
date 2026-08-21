"""Fix audit_log header row to match VPS TAB_HEADERS.auditLog (12 cols):
  audit_id, timestamp, actor_user_id, actor_role, action, entity, entity_id,
  before_value, after_value, reason, ip_address, chain_hash

Trade-off: 295 rows that already have idx1=timestamp will map correctly.
87 old rows with idx1=user_id will have that value mislabelled as 'timestamp',
but the data is preserved (not lost). Full per-row remap of 382 rows across 6
different layouts is too risky for production audit data.

Only row 1 (header) is written — no data rows are touched.
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

EXPECTED = ['audit_id', 'timestamp', 'actor_user_id', 'actor_role', 'action',
            'entity', 'entity_id', 'before_value', 'after_value', 'reason',
            'ip_address', 'chain_hash']

res = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="audit_log!A1:L1").execute()
before = res.get("values", [[""]])[0]
print(f"BEFORE ({len(before)}): {before}")
body = {"values": [EXPECTED]}
svc.spreadsheets().values().update(spreadsheetId=SPREAD, range="audit_log!A1:L1",
                                   valueInputOption="RAW", body=body).execute()
res2 = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="audit_log!A1:L1").execute()
after = res2.get("values", [[""]])[0]
print(f"AFTER  ({len(after)}): {after}")
print("MATCH" if after == EXPECTED else "STILL MISMATCH")

# Sanity: read a recent row (new layout) to confirm it maps correctly
res3 = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="audit_log!A380:L385").execute()
rows = res3.get("values", [])
h = EXPECTED
print("\nrecent rows mapped to new header:")
for r in rows:
    if not r or not r[0].strip():
        continue
    obj = {h[i]: (r[i] if i < len(r) else "") for i in range(len(h))}
    print(f"  {obj.get('audit_id')}: ts={obj.get('timestamp')!r} actor={obj.get('actor_user_id')!r} action={obj.get('action')!r}")