"""Deploy the absen-bot hardening (goal awal) to VPS ykp-hr-v1 (port 3008).

Uploads the bounded-lookup + webhook-hardening changes for the Telegram
attendance bot, rebuilds, and restarts PM2.

Files (local relative path -> mode):
  local  : always overwrite
  safe   : skip if the VPS copy still has dev-only refs (createLinkCode /
           telegramLinkCodes) that need a manual merge

Only ykp-hr-v1 is touched — the other 5 apps are unchanged by this work.
"""
import os, sys, paramiko, time

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"
PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"
VPS_ROOT = "/home/dev/ykp"
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Absen-bot only. mock-store.ts is modified (resetMockStore) but the VPS runs
# USE_MOCK_DB=false so mock-store never executes in prod — still upload so the
# repo state matches (and tests on the VPS can run). sheets.ts is "safe": the
# VPS HR copy has dev-only telegramLinkCodes refs that need manual merge, so
# we skip it (the bounded-lookup changes do not require sheets.ts changes).
FILES = [
    ("ykp-hr-v1/src/app/api/hr/attendance/telegram/route.ts", "local"),
    ("ykp-hr-v1/src/lib/attendance-service.ts", "local"),
    ("ykp-hr-v1/src/lib/telegram-attendance.ts", "local"),
    ("ykp-hr-v1/src/lib/attendance-lookup.ts", "local"),
    ("ykp-hr-v1/src/lib/attendance-lookup.test.ts", "local"),
    ("ykp-hr-v1/src/db/mock-store.ts", "local"),
]

VPS_APP = ("ykp-hr-v1", "ykp-hr-v1")


def read_local(rel):
    with open(os.path.join(REPO, rel), "r", encoding="utf-8") as f:
        return f.read()


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
                print(f"[SKIP-DEV] {rel} - VPS has dev-only refs, needs manual merge")
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

    app_dir, pm2_name = VPS_APP
    print(f"\n===== BUILD {app_dir} =====", flush=True)
    # Run build and capture exit code; `tail` would swallow the success line.
    cmd = (
        f"export PATH={PATH}; "
        f"cd /home/dev/ykp/{app_dir} && "
        f"npm run build > /tmp/build_hr.log 2>&1; echo \"EXIT=$?\"; "
        f"grep -E 'Compiled successfully|Failed to compile|Error:|Type error' /tmp/build_hr.log | tail -5"
    )
    out, err = run(c, cmd, timeout=300)
    print(out)
    if err.strip():
        print("STDERR:", err)
    build_ok = "EXIT=0" in out and "Failed to compile" not in out and "Type error" not in out
    if not build_ok:
        print(f"[FAIL] {app_dir} build failed — dumping /tmp/build_hr.log tail")
        out2, _ = run(c, "export PATH={PATH}; tail -30 /tmp/build_hr.log", timeout=30)
        print(out2)
        sys.exit(2)

    print(f"\n===== RESTART {pm2_name} =====", flush=True)
    cmd = f"export PATH={PATH}; cd /home/dev/ykp/{app_dir} && pm2 restart {pm2_name} --update-env 2>&1 | tail -10"
    out, err = run(c, cmd, timeout=60)
    print(out)
    if err.strip():
        print("STDERR:", err)

    print("\n===== HEALTH CHECK =====")
    time.sleep(3)
    cmd = f"export PATH={PATH}; curl -s -o /dev/null -w '%{{http_code}}' http://localhost:3008/api/hr/summary?date=2026-08-21"
    out, err = run(c, cmd, timeout=30)
    print(f"GET /api/hr/summary (no auth, public allowlist) -> HTTP {out.strip()}")

    # Webhook secret check: POST with no secret -> 401
    cmd = (
        f"export PATH={PATH}; "
        f"curl -s -o /dev/null -w '%{{http_code}}' "
        f"-X POST http://localhost:3008/api/hr/attendance/telegram "
        f"-H 'Content-Type: application/json' "
        f"-d '{{}}'"
    )
    out, err = run(c, cmd, timeout=30)
    print(f"POST /api/hr/attendance/telegram (no secret) -> HTTP {out.strip()} (expect 401)")

    c.close()
    print("\nDONE")


if __name__ == "__main__":
    main()