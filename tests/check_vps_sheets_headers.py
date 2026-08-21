"""Read TAB_HEADERS.outlets + TAB_HEADERS.employees from the VPS ykp-hr-v1
sheets.ts (which is SKIP-DEV — has telegramLinkCodes refs) to see if the VPS
code expects the live header layout (with latitude/longitude at index 5-7)
or the repo layout."""
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
sftp = c.open_sftp()
with sftp.open("/home/dev/ykp/ykp-hr-v1/src/db/sheets.ts", "r") as f:
    src = f.read().decode("utf-8", "replace")
sftp.close()
c.close()

import re
# Find the outlets header block
for key in ["outlets", "employees", "attendance"]:
    m = re.search(r"\[TABS\." + key + r"\]:\s*\[([^\]]+)\]", src)
    if m:
        cols = [x.strip().strip("'").strip('"') for x in m.group(1).split(',') if x.strip() and not x.strip().startswith("//")]
        print(f"VPS TAB_HEADERS.{key} ({len(cols)} cols):")
        for i, col in enumerate(cols):
            print(f"  [{i}] {col}")
        print()