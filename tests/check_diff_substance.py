"""For each DIFF file, check if the difference is only whitespace/CRLF
(normalized identical) or real content. Reports REAL vs WHITESPACE-ONLY."""
import os, paramiko

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = "187.77.114.168"
ROOT = "/home/dev/ykp"

DIFF = [
    "ykp-finance-v1/src/app/api/finance/actions/route.ts",
    "ykp-finance-v1/src/app/api/finance/alerts/route.ts",
    "ykp-finance-v1/src/app/api/finance/audit/route.ts",
    "ykp-finance-v1/src/app/api/finance/closing-cash/route.ts",
    "ykp-finance-v1/src/app/api/finance/expenses/[id]/route.ts",
    "ykp-finance-v1/src/app/api/finance/notify/daily-brief/route.ts",
    "ykp-finance-v1/src/app/api/finance/petty-cash/route.ts",
    "ykp-finance-v1/src/app/finance/settings/page.tsx",
    "ykp-finance-v1/src/app/finance/settings/settings-client.tsx",
    "ykp-finance-v1/src/lib/approval.ts",
    "ykp-finance-v1/src/lib/moka-importer.ts",
    "ykp-hermez/README.md",
    "ykp-hermez/package.json",
    "ykp-hermez/src/brain.ts",
    "ykp-hermez/src/brief.ts",
    "ykp-hermez/src/config.ts",
    "ykp-hermez/src/index.ts",
    "ykp-hermez/src/telegram.ts",
    "ykp-hr-v1/middleware.ts",
    "ykp-hr-v1/src/app/api/hr/audit/route.ts",
    "ykp-hr-v1/src/db/mock-store.ts",
    "ykp-investor-v1/src/app/api/investor/audit/route.ts",
    "ykp-investor-v1/src/app/api/investor/dividend/route.ts",
    "ykp-investor-v1/src/lib/investor-summary.ts",
    "ykp-warehouse-v1/src/app/api/warehouse/adjustment/route.ts",
    "ykp-warehouse-v1/src/app/api/warehouse/closing/route.ts",
    "ykp-warehouse-v1/src/app/api/warehouse/notify/daily-brief/route.ts",
    "ykp-warehouse-v1/src/app/api/warehouse/receiving/route.ts",
    "ykp-warehouse-v1/src/app/api/warehouse/waste/route.ts",
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="dev", password="password", timeout=30)
sftp = c.open_sftp()

real, ws = [], []
for rel in DIFF:
    local_path = os.path.join(REPO, rel.replace("/", os.sep))
    with open(local_path, "r", encoding="utf-8") as f:
        local = f.read()
    try:
        with sftp.open(f"{ROOT}/{rel}", "r") as rf:
            vps = rf.read().decode("utf-8", errors="replace")
    except IOError:
        print(f"VPS-MISSING {rel}")
        continue
    # normalize line endings + trailing whitespace
    ln = local.replace("\r\n", "\n").rstrip()
    vn = vps.replace("\r\n", "\n").rstrip()
    if ln == vn:
        ws.append(rel)  # whitespace-only diff
    else:
        real.append(rel)
        # show a short hint of the first differing line
        ll = ln.splitlines()
        vl = vn.splitlines()
        for i in range(min(len(ll), len(vl))):
            if ll[i] != vl[i]:
                print(f"  REAL-DIFF {rel} line {i+1}:\n    local: {ll[i][:80]!r}\n    vps:   {vl[i][:80]!r}")
                break
        else:
            print(f"  REAL-DIFF {rel}: length differs (local {len(ll)} vs vps {len(vl)} lines)")

sftp.close()
c.close()
print(f"\nREAL-DIFF ({len(real)}):")
for s in real:
    print(f"  ! {s}")
print(f"WS-ONLY ({len(ws)}):")
for s in ws:
    print(f"  w {s}")