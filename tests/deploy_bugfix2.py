"""Deploy DEEP-BUG-RESEARCH-2 fixes (49 bugs, 6 modules) to VPS.

Strategy:
  1. SFTP-upload every changed/new file from the 6 subagents into /home/dev/ykp/<app>/.
  2. For each VPS-resident app, run `npm run build` sequentially on the VPS (VPS has RAM;
     local Windows OOMs on parallel builds).
  3. `pm2 restart <name> --update-env` for each.
  4. Hermez (bot worker) lives at /home/dev/ykp/ykp-hermez on VPS — upload + tsc build +
     pm2 restart ykp-hermez-bot.

Files that the VPS may have in a divergent dev-only state (telegram-link-code in
sheets.ts/telegram.ts) are handled by checking for dev-only refs before overwriting;
if present, we skip with a warning (manual merge needed). This mirrors deploy_p1p2.py.

Note: ykp-erp/* (Hub/Finance/HR/Hermez-web) are on Railway, NOT this VPS — not deployed here.
"""
import os, sys, paramiko, time

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"
PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"
VPS_ROOT = "/home/dev/ykp"
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (local relative path, mode) — mode is "local" (always overwrite) or "safe"
# (skip if VPS file has dev-only refs createLinkCode/telegramLinkCodes).
FILES = [
    # warehouse (17 bugs)
    ("ykp-warehouse-v1/src/lib/stock-ledger.ts", "local"),
    ("ykp-warehouse-v1/src/lib/repo.ts", "local"),
    ("ykp-warehouse-v1/src/lib/telegram.ts", "safe"),
    ("ykp-warehouse-v1/src/lib/alert-dedupe.ts", "local"),
    ("ykp-warehouse-v1/src/app/api/warehouse/transfer/route.ts", "local"),
    ("ykp-warehouse-v1/src/app/api/warehouse/waste/route.ts", "local"),
    ("ykp-warehouse-v1/src/app/api/warehouse/purchase-request/route.ts", "local"),
    ("ykp-warehouse-v1/src/app/api/warehouse/stock-count/route.ts", "local"),
    ("ykp-warehouse-v1/src/app/api/warehouse/stock-issue/route.ts", "local"),
    ("ykp-warehouse-v1/src/app/api/warehouse/adjustment/route.ts", "local"),
    ("ykp-warehouse-v1/src/app/api/warehouse/batch-stock/route.ts", "local"),
    ("ykp-warehouse-v1/src/app/api/warehouse/notify/daily-brief/route.ts", "local"),
    ("ykp-warehouse-v1/src/app/api/warehouse/actions/route.ts", "local"),
    ("ykp-warehouse-v1/src/app/api/warehouse/receiving/route.ts", "local"),
    ("ykp-warehouse-v1/src/app/api/warehouse/closing/route.ts", "local"),
    ("ykp-warehouse-v1/src/db/sheets.ts", "safe"),
    ("ykp-warehouse-v1/tests/deep-bug-fixes.test.ts", "local"),
    ("ykp-warehouse-v1/tests/alert-dedupe.test.ts", "local"),
    ("ykp-warehouse-v1/tests/batch-stock-receipt.test.ts", "local"),

    # finance (14 bugs)
    ("ykp-finance-v1/src/app/api/finance/audit/route.ts", "local"),
    ("ykp-finance-v1/src/app/api/finance/closing-cash/route.ts", "local"),
    ("ykp-finance-v1/src/app/api/finance/expenses/[id]/route.ts", "local"),
    ("ykp-finance-v1/src/app/api/finance/notify/daily-brief/route.ts", "local"),
    ("ykp-finance-v1/src/app/api/finance/petty-cash/route.ts", "local"),
    ("ykp-finance-v1/src/app/api/finance/suppliers/[id]/approve-payment/route.ts", "local"),
    ("ykp-finance-v1/src/app/api/finance/suppliers/[id]/route.ts", "local"),
    ("ykp-finance-v1/src/app/api/finance/alerts/route.ts", "local"),
    ("ykp-finance-v1/src/app/api/finance/actions/route.ts", "local"),
    ("ykp-finance-v1/src/lib/moka-importer.ts", "local"),
    ("ykp-finance-v1/src/lib/telegram.ts", "safe"),
    ("ykp-finance-v1/src/db/sheets.ts", "safe"),
    ("ykp-finance-v1/src/lib/approval.ts", "local"),
    ("ykp-finance-v1/src/lib/concurrency.ts", "local"),
    ("ykp-finance-v1/src/lib/settings.ts", "local"),
    ("ykp-finance-v1/src/app/api/finance/settings/route.ts", "local"),
    ("ykp-finance-v1/src/app/finance/settings/page.tsx", "local"),
    ("ykp-finance-v1/src/app/finance/settings/settings-client.tsx", "local"),
    ("ykp-finance-v1/tests/finance-bug-fixes.test.ts", "local"),
    ("ykp-finance-v1/tests/moka-importer.test.ts", "local"),
    ("ykp-finance-v1/tests/concurrency.test.ts", "local"),
    ("ykp-finance-v1/tests/expense-approve-route.test.ts", "local"),

    # hr-v1 (6 bugs)
    ("ykp-hr-v1/src/app/api/hr/employees/import/route.ts", "local"),
    ("ykp-hr-v1/src/app/api/hr/attendance/correction/route.ts", "local"),
    ("ykp-hr-v1/src/app/api/hr/adjustments/route.ts", "local"),
    ("ykp-hr-v1/src/app/api/hr/employees/route.ts", "local"),
    ("ykp-hr-v1/src/app/api/hr/telegram-actor/route.ts", "local"),
    ("ykp-hr-v1/src/app/api/hr/attendance/correction/route.test.ts", "local"),
    ("ykp-hr-v1/src/app/api/hr/employees/import/route.test.ts", "local"),
    ("ykp-hr-v1/src/app/api/hr/telegram-actor/route.test.ts", "local"),
    ("ykp-hr-v1/src/db/sheets.ts", "safe"),
    ("ykp-hr-v1/middleware.ts", "local"),
    ("ykp-hr-v1/src/app/api/hr/audit/route.ts", "local"),
    ("ykp-hr-v1/src/app/api/hr/payslip/[id]/route.ts", "local"),
    ("ykp-hr-v1/src/db/mock-store.ts", "local"),

    # investor (4 bugs)
    ("ykp-investor-v1/src/app/api/investor/summary/route.ts", "local"),
    ("ykp-investor-v1/src/app/api/investor/capital/route.ts", "local"),
    ("ykp-investor-v1/src/lib/investor-summary.ts", "local"),
    ("ykp-investor-v1/src/db/sheets.ts", "safe"),
    ("ykp-investor-v1/src/app/api/investor/audit/route.ts", "local"),
    ("ykp-investor-v1/src/app/api/investor/dividend/route.ts", "local"),
    ("ykp-investor-v1/tests/investor-summary-route.test.ts", "local"),

    # ops (6 bugs)
    ("ykp-ops-v1/src/lib/ops-summary.ts", "local"),
    ("ykp-ops-v1/src/lib/ops-summary.test.ts", "local"),
    ("ykp-ops-v1/src/db/sheets.ts", "local"),
    ("ykp-ops-v1/src/app/api/ops/summary/route.ts", "local"),
    ("ykp-ops-v1/src/app/api/ops/kds/route.ts", "local"),
    ("ykp-ops-v1/src/app/api/auth/login/route.ts", "local"),

    # hermez bot worker (3 bugs) — VPS ykp-hermez
    ("ykp-hermez/src/scope.ts", "local"),
    ("ykp-hermez/src/scope.test.ts", "local"),
    ("ykp-hermez/src/tools.ts", "local"),
    ("ykp-hermez/src/config.ts", "local"),
    ("ykp-hermez/src/index.ts", "local"),
    ("ykp-hermez/src/actor.ts", "local"),
    ("ykp-hermez/src/actor.test.ts", "local"),
    ("ykp-hermez/src/llm.ts", "local"),
]

# (repo dir, pm2 name)
VPS_APPS = [
    ("ykp-hr-v1", "ykp-hr-v1"),
    ("ykp-finance-v1", "ykp-finance-v1"),
    ("ykp-warehouse-v1", "ykp-warehouse"),
    ("ykp-investor-v1", "ykp-investor"),
    ("ykp-ops-v1", "ykp-ops"),
    ("ykp-hermez", "ykp-hermez-bot"),
]


def read_local(rel):
    with open(os.path.join(REPO, rel), "r", encoding="utf-8") as f:
        return f.read()


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=30)
    sftp = c.open_sftp()

    uploaded, skipped, same = [], [], []
    for rel, mode in FILES:
        local_path = os.path.join(REPO, rel)
        remote_path = f"{VPS_ROOT}/{rel}"
        try:
            with sftp.open(remote_path, "r") as rf:
                vps = rf.read().decode("utf-8", errors="replace")
            vps_present = True
        except IOError:
            vps_present = False
            vps = None

        if not vps_present:
            remote_dir = os.path.dirname(remote_path)
            run(c, f"mkdir -p {remote_dir}")
            print(f"[NEW] {rel}")
            sftp.put(local_path, remote_path)
            uploaded.append(rel)
            continue

        local = read_local(rel)
        if local.strip() == (vps.strip() if vps else ""):
            print(f"[SAME] {rel}")
            same.append(rel)
            continue

        if mode == "safe":
            has_dev = ("createLinkCode" in (vps or "")) or ("telegramLinkCodes" in (vps or ""))
            if has_dev:
                print(f"[SKIP-DEV] {rel} — VPS has dev-only refs, needs manual merge")
                skipped.append(rel)
                continue

        print(f"[PUT] {rel}")
        sftp.put(local_path, remote_path)
        uploaded.append(rel)

    sftp.close()

    print(f"\n===== UPLOAD SUMMARY =====")
    print(f"uploaded: {len(uploaded)}, same: {len(same)}, skipped: {len(skipped)}")
    if skipped:
        print("SKIP (manual merge):")
        for s in skipped:
            print(f"  - {s}")

    failures = []
    for app_dir, pm2_name in VPS_APPS:
        print(f"\n===== BUILD {app_dir} =====", flush=True)
        if app_dir == "ykp-hermez":
            # bot worker: tsc compile, not next build
            cmd = (
                f"export PATH={PATH}; "
                f"cd /home/dev/ykp/{app_dir} && "
                f"npx tsc --noEmit 2>&1 | tail -20"
            )
        else:
            cmd = (
                f"export PATH={PATH}; "
                f"cd /home/dev/ykp/{app_dir} && "
                f"npm run build 2>&1 | tail -12"
            )
        stdin, stdout, stderr = c.exec_command(cmd, timeout=900)
        out = stdout.read().decode()
        status = stdout.channel.recv_exit_status()
        print(out)
        print(f"build exit: {status}", flush=True)
        if status != 0:
            print(f"!!! BUILD FAILED for {app_dir}", flush=True)
            failures.append(app_dir)
            continue
        print(f"===== RESTART {pm2_name} =====", flush=True)
        cmd2 = f"export PATH={PATH}; pm2 restart {pm2_name} --update-env 2>&1 | tail -4"
        stdin, stdout, stderr = c.exec_command(cmd2, timeout=60)
        print(stdout.read().decode())
        stdout.channel.recv_exit_status()

    c.close()

    print("\n===== FINAL SUMMARY =====")
    if failures:
        print(f"FAILED builds: {', '.join(failures)}")
        sys.exit(1)
    print("ALL BUILDS + RESTARTS OK")


def run(c, cmd):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
    return stdout.read().decode(), stderr.read().decode()


if __name__ == "__main__":
    main()