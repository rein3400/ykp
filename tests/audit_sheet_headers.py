"""Audit every HR sheet tab header against TAB_HEADERS in sheets.ts to find
mismatches like the master_employee one (where data followed the new layout
but the header row was stale)."""
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

# Read sheets.ts TAB_HEADERS from the local repo (already deployed to VPS)
import os, re
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(REPO, "ykp-hr-v1/src/db/sheets.ts"), "r", encoding="utf-8") as f:
    src = f.read()

# Parse the TABS + TAB_HEADERS block (simple regex over the object literal)
# Find the TABS mapping
tabs_m = re.search(r"TABS\s*=\s*\{([^}]+)\}", src)
tab_map = {}
for line in tabs_m.group(1).splitlines():
    mm = re.match(r"\s*(\w+):\s*'([^']+)'", line)
    if mm:
        tab_map[mm.group(1)] = mm.group(2)
print(f"TABS: {tab_map}")

# Parse TAB_HEADERS blocks - find each [TABS.x]: [ ... ]
header_blocks = {}
for m in re.finditer(r"\[TABS\.(\w+)\]:\s*\[([^\]]+)\]", src):
    key = m.group(1)
    cols = [c.strip().strip("'").strip('"') for c in m.group(2).split(',') if c.strip()]
    header_blocks[key] = cols

print(f"\nTabs in TAB_HEADERS: {list(header_blocks.keys())}")

# Read the spreadsheet metadata to list all tabs
meta = svc.spreadsheets().get(spreadsheetId=SPREAD).execute()
sheet_tabs = [s.get("properties", {}).get("title") for s in meta.get("sheets", [])]
print(f"\nSheet tabs present: {sheet_tabs}")

# For each tab in TAB_HEADERS, compare live header vs expected
print("\n=== HEADER AUDIT ===")
for key, expected in header_blocks.items():
    tab = tab_map.get(key, key)
    if tab not in sheet_tabs:
        print(f"\n[MISSING-TAB] {key} -> '{tab}' (not in spreadsheet)")
        continue
    res = svc.spreadsheets().values().get(spreadsheetId=SPREAD, range=f"{tab}!A1:Z1").execute()
    live = res.get("values", [[""]])[0]
    if live == expected:
        print(f"[OK] {key} ('{tab}'): {len(live)} cols match")
    else:
        print(f"\n[MISMATCH] {key} ('{tab}'):")
        print(f"  expected ({len(expected)}): {expected}")
        print(f"  live     ({len(live)}): {live}")
        # show first diff
        for i in range(max(len(expected), len(live))):
            e = expected[i] if i < len(expected) else "<none>"
            l = live[i] if i < len(live) else "<none>"
            if e != l:
                print(f"    first diff at [{i}]: expected {e!r} live {l!r}")
                break