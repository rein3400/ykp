"""Audit: compare every changed file (git M + ??) in the 6 VPS apps against the
VPS copy. Reports:
  - DIFF  : local differs from VPS (needs deploy)
  - MISSING: file exists locally but not on VPS (needs upload)
  - SAME  : identical
  - SKIP-DEV: VPS has dev-only refs (telegramLinkCodes/createLinkCode) -> manual merge

Excludes pure-local test scaffolding (tests/*.test.ts, test-live*.mjs) from the
DIFF/MISSING action only when the VPS app has no such dir; we still report them.
"""
import os, sys, paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"
VPS_ROOT = "/home/dev/ykp"
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

APPS = ["ykp-hr-v1", "ykp-warehouse-v1", "ykp-investor-v1", "ykp-ops-v1",
        "ykp-finance-v1", "ykp-hermez"]

# Files that are dev-only test scaffolding not required for the app to run.
# We still report them but mark them as TEST (no action needed for prod runtime).
def is_test_only(rel):
    low = rel.replace("\\", "/")
    return (low.endswith(".test.ts") or low.endswith(".test.tsx")
            or low.endswith(".test.mjs") or low.endswith(".test.js")
            or low.endswith("test-live.mjs") or low.endswith("test-live2.mjs"))


def main():
    # Gather changed files from git for the 6 apps.
    import subprocess
    out = subprocess.check_output(
        ["git", "status", "--porcelain"], cwd=REPO, text=True
    )
    changed = []
    for line in out.splitlines():
        if not line.strip():
            continue
        status = line[:2]
        path = line[3:]
        # normalize
        path = path.replace("\\", "/")
        top = path.split("/")[0]
        if top not in APPS:
            continue
        changed.append((status.strip(), path))

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, timeout=30)
    sftp = c.open_sftp()

    diff, missing, same, skipdev, tests = [], [], [], [], []
    for status, rel in changed:
        local_path = os.path.join(REPO, rel.replace("/", os.sep))
        remote_path = f"{VPS_ROOT}/{rel}"
        try:
            with open(local_path, "r", encoding="utf-8") as f:
                local = f.read()
        except (IOError, UnicodeDecodeError) as e:
            print(f"[ERR-LOCAL] {rel}: {e}")
            continue

        try:
            with sftp.open(remote_path, "rb") as rf:
                vps = rf.read().decode("utf-8", errors="replace")
            vps_present = True
        except IOError:
            vps_present = False
            vps = None

        test_only = is_test_only(rel)

        if not vps_present:
            if test_only:
                tests.append(rel)
            else:
                missing.append(rel)
            continue

        # Normalize newlines (CRLF vs LF vs lone CR) before comparing — the
        # VPS copies sometimes carry \r\r\n (double CR) which Python's text
        # mode translate to \n\n while a raw read keeps \r\r\n.
        local_n = local.replace("\r\n", "\n").replace("\r", "\n")
        vps_n = (vps or "").replace("\r\n", "\n").replace("\r", "\n")
        if local_n.strip() == vps_n.strip():
            same.append(rel)
            continue

        # differs
        if ("createLinkCode" in (vps or "")) or ("telegramLinkCodes" in (vps or "")):
            skipdev.append(rel)
        elif test_only:
            tests.append(rel)
        else:
            diff.append(rel)

    sftp.close()
    c.close()

    print("=" * 60)
    print("DEPLOY GAP AUDIT (6 VPS apps vs local working tree)")
    print("=" * 60)
    print(f"\nSAME ({len(same)}): already deployed")
    for s in same:
        print(f"  = {s}")

    print(f"\nDIFF — needs deploy ({len(diff)}):")
    for s in diff:
        print(f"  ! {s}")

    print(f"\nMISSING — needs upload ({len(missing)}):")
    for s in missing:
        print(f"  + {s}")

    print(f"\nSKIP-DEV — VPS has dev-only refs, manual merge ({len(skipdev)}):")
    for s in skipdev:
        print(f"  ~ {s}")

    print(f"\nTEST-ONLY — test files, not required for prod runtime ({len(tests)}):")
    for s in tests:
        print(f"  t {s}")

    print(f"\nTOTAL: {len(same)} same, {len(diff)} diff, {len(missing)} missing, "
          f"{len(skipdev)} skip-dev, {len(tests)} test-only")


if __name__ == "__main__":
    main()