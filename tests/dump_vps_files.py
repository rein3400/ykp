"""Read the VPS version of each SKIP-DEV file and the local repo version, then
write a unified diff to a file so we can plan the manual merge. We download
VPS content to /tmp and use python difflib (no shell diff needed)."""
import os, paramiko, difflib

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = "187.77.114.168"

SKIP_DEV = [
    "ykp-hr-v1/src/db/sheets.ts",
    "ykp-finance-v1/src/db/sheets.ts",
    "ykp-investor-v1/src/db/sheets.ts",
    "ykp-ops-v1/src/db/sheets.ts",
    "ykp-warehouse-v1/src/db/sheets.ts",
    "ykp-finance-v1/src/lib/telegram.ts",
    "ykp-warehouse-v1/src/lib/telegram.ts",
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="dev", password="password", timeout=30)
sftp = c.open_sftp()

os.makedirs(os.path.join(REPO, "rev", "vps"), exist_ok=True)
os.makedirs(os.path.join(REPO, "rev", "local"), exist_ok=True)

for rel in SKIP_DEV:
    vps_path = f"/home/dev/ykp/{rel}"
    local_path = os.path.join(REPO, rel.replace("/", os.sep))
    with sftp.open(vps_path, "r") as f:
        vps = f.read().decode("utf-8", "replace")
    with open(local_path, "r", encoding="utf-8") as f:
        local = f.read()
    # save copies for inspection
    safe = rel.replace("/", "__")
    with open(os.path.join(REPO, "rev", "vps", safe), "w", encoding="utf-8") as f:
        f.write(vps)
    with open(os.path.join(REPO, "rev", "local", safe), "w", encoding="utf-8") as f:
        f.write(local)
    # unified diff
    diff = difflib.unified_diff(
        local.splitlines(keepends=True),
        vps.splitlines(keepends=True),
        fromfile=f"LOCAL {rel}", tofile=f"VPS {rel}", n=3
    )
    difftxt = "".join(diff)
    print(f"\n{'='*70}\n{rel}\n{'='*70}")
    # print summary stats
    print(f"local: {len(local)} bytes / {len(local.splitlines())} lines")
    print(f"vps  : {len(vps)} bytes / {len(vps.splitlines())} lines")
    # print first 60 diff lines
    lines = difftxt.splitlines()
    print(f"diff lines: {len(lines)}")
    for ln in lines[:80]:
        print(ln)
    if len(lines) > 80:
        print(f"... ({len(lines)-80} more diff lines)")
    # save full diff
    with open(os.path.join(REPO, "rev", safe + ".diff"), "w", encoding="utf-8") as f:
        f.write(difftxt)

sftp.close()
c.close()
print("\n\nSaved copies to rev/vps/ and rev/local/, full diffs to rev/*.diff")