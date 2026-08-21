"""Delete the test attendance row ATT-256 (today) from the live sheet so the
verification run does not leave a permanent test record."""
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

# Find row number of ATT-256
res = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range="hr_attendance!A1:A2000").execute()
rows = res.get("values", [])
row_num = None
for i, r in enumerate(rows[1:], start=2):
    if r and r[0] == "ATT-256":
        row_num = i
        break
print(f"ATT-256 at row {row_num}")
if row_num:
    # clear the row contents (set empty), then use batchUpdate clearDimension
    # Simpler: use values.clear on the exact row range
    svc.spreadsheets().values().clear(
        spreadsheetId=SPREAD,
        range=f"hr_attendance!A{row_num}:AB{row_num}",
        body={},
    ).execute()
    print(f"cleared row {row_num}")