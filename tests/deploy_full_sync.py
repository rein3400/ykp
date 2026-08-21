"""Full-sync deploy: upload every changed file in the 6 VPS apps, skip the
7 SKIP-DEV files (VPS sheets.ts/telegram.ts with dev-only telegramLinkCodes/
createLinkCode refs that need manual merge), remove the deleted openrouter.ts
on VPS, then build + restart all 6 apps.

Run order:
  1. Upload 29 DIFF files (28 whitespace-only + 1 real hermez telegram.ts)
  2. Upload 4 TEST-ONLY files (sinkron repo, tidak affect runtime)
  3. Remove ykp-hermez/src/openrouter.ts on VPS (deleted locally)
  4. Build each app sequentially (VPS RAM-limited)
  5. Restart each PM2 app
  6. Health check each app

SKIP-DEV (7) — NOT touched, need manual merge:
  ykp-finance-v1/src/db/sheets.ts
  ykp-finance-v1/src/lib/telegram.ts
  ykp-hr-v1/src/db/sheets.ts
  ykp-investor-v1/src/db/sheets.ts
  ykp-ops-v1/src/db/sheets.ts
  ykp-warehouse-v1/src/db/sheets.ts
  ykp-warehouse-v1/src/lib/telegram.ts
"""
import os, sys, paramiko, time

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"
PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"
VPS_ROOT = "/home/dev/ykp"
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 29 DIFF files (local differs from VPS) — upload all.
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

# 4 TEST-ONLY files — upload for repo sync (not required for runtime, but
# keeps the VPS repo usable for `npm test`).
TEST_ONLY = [
    "ykp-finance-v1/tests/approval.test.ts",
    "ykp-finance-v1/tests/moka-importer.test.ts",
    "ykp-hermez/test-live.mjs",
    "ykp-hermez/test-live2.mjs",
]

# Deleted locally, remove on VPS.
VPS_DELETE = [
    "ykp-hermez/src/openrouter.ts",
]

# (repo dir, pm2 name, build_kind)
# hermez build = `npm run build` (tsc compile to dist/), NOT tsc --noEmit,
# because pm2 starts `node dist/index.js` — dist/ must be recompiled.
VPS_APPS = [
    ("ykp-hr-v1", "ykp-hr-v1", "next"),
    ("ykp-finance-v1", "ykp-finance-v1", "next"),
    ("ykp-warehouse-v1", "ykp-warehouse", "next"),
    ("ykp-investor-v1", "ykp-investor", "next"),
    ("ykp-ops-v1", "ykp-ops", "next"),
    ("ykp-hermez", "ykp-hermez-bot", "tsc-build"),
]

HEALTH = [
    ("ykp-hr-v1", "http://localhost:3008/api/hr/summary?date=2026-08-21", "200"),
    ("ykp-finance-v1", "http://localhost:3009/api/finance/summary?date=2026-08-21", None),
    ("ykp-warehouse-v1", "http://localhost:3005/api/warehouse/summary?date=2026-08-21", None),
    ("ykp-investor-v1", "http://localhost:3006/api/investor/summary", None),
    ("ykp-ops-v1", "http://localhost:3007/api/ops/summary?date=2026-08-21", None),
]


def run(c, cmd, timeout=300):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return out, err


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=30)
    sftp = c.open_sftp()

    uploaded = 0
    for rel in DIFF + TEST_ONLY:
        local_path = os.path.join(REPO, rel.replace("/", os.sep))
        remote_path = f"{VPS_ROOT}/{rel}"
        run(c, f"mkdir -p {os.path.dirname(remote_path)}")
        print(f"[PUT] {rel}")
        sftp.put(local_path, remote_path)
        uploaded += 1

    for rel in VPS_DELETE:
        remote_path = f"{VPS_ROOT}/{rel}"
        try:
            sftp.remove(remote_path)
            print(f"[DEL] {rel}")
        except IOError:
            print(f"[DEL-SKIP] {rel} (not present)")

    sftp.close()
    print(f"\nuploaded {uploaded} files, deleted {len(VPS_DELETE)}")

    # Build each app sequentially
    failures = []
    for app_dir, pm2_name, kind in VPS_APPS:
        print(f"\n===== BUILD {app_dir} ({kind}) =====", flush=True)
        if kind == "tsc-build":
            # npm install (package.json gained vitest devDep) then npm run build
            # (tsc -> dist/), since pm2 starts node dist/index.js.
            cmd = (
                f"export PATH={PATH}; "
                f"cd /home/dev/ykp/{app_dir} && "
                f"npm install --no-audit --no-fund > /tmp/build_{app_dir}.log 2>&1 && "
                f"npm run build >> /tmp/build_{app_dir}.log 2>&1; "
                f"echo \"EXIT=$?\"; grep -E 'error TS|Compiled|Exit' /tmp/build_{app_dir}.log | tail -5; "
                f"tail -3 /tmp/build_{app_dir}.log"
            )
        else:
            cmd = (
                f"export PATH={PATH}; "
                f"cd /home/dev/ykp/{app_dir} && "
                f"npm run build > /tmp/build_{app_dir}.log 2>&1; "
                f"echo \"EXIT=$?\"; grep -E 'Compiled successfully|Failed to compile|Type error|Error:' /tmp/build_{app_dir}.log | tail -5"
            )
        out, err = run(c, cmd, timeout=300)
        print(out)
        if err.strip():
            print("STDERR:", err)
        ok = "EXIT=0" in out and "Failed to compile" not in out and "Type error" not in out
        if not ok:
            print(f"[FAIL] {app_dir} build")
            out2, _ = run(c, f"export PATH={PATH}; tail -30 /tmp/build_{app_dir}.log", timeout=30)
            print(out2)
            failures.append(app_dir)
            # don't restart a failed build
            continue

        print(f"[RESTART] {pm2_name}", flush=True)
        cmd = f"export PATH={PATH}; cd /home/dev/ykp/{app_dir} && pm2 restart {pm2_name} --update-env 2>&1 | tail -3"
        out, err = run(c, cmd, timeout=60)
        print(out)

    print("\n===== HEALTH CHECK =====")
    time.sleep(4)
    for app_dir, url, expect in HEALTH:
        out, _ = run(c, f"export PATH={PATH}; curl -s -o /dev/null -w '%{{http_code}}' '{url}'", timeout=30)
        status = out.strip()
        tag = "OK" if (expect is None or status == expect) else "UNEXPECTED"
        print(f"  {tag} {app_dir}: {url} -> HTTP {status}" + (f" (expected {expect})" if expect else ""))

    c.close()
    if failures:
        print(f"\nBUILD FAILURES: {failures}")
        sys.exit(2)
    print("\nDONE - full sync complete")


if __name__ == "__main__":
    main()