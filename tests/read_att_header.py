"""Read full hr_attendance header to know all columns."""
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
res = svc.spreadsheets().values().get(spreadsheetId=vals["YKP_HR_SPREADSHEET_ID"], range="hr_attendance!A1:AB1").execute()
print("hr_attendance header:")
for i, h in enumerate(res.get("values", [[""]])[0]):
    print(f"  [{i}] {h!r}")
# also the last 3 data rows to see shape
res2 = svc.spreadsheets().values().get(spreadsheetId=vals["YKP_HR_SPREADSHEET_ID"], range="hr_attendance!A853:Z856").execute()
print("\nlast 4 rows:")
for r in res2.get("values", []):
    print(f"  {r}")