"""Deploy P1/P2 fixes to VPS: upload changed files, then build+restart separately.

Uploads only the files this goal changed. None overlap with VPS-only
telegram-link-code sheets.ts/telegram.ts, so no HEAD-restore needed.
For merge-mode files (receiving, batch-stock), check VPS lacks dev-only refs
(createLinkCode/telegramLinkCodes) before overwriting.
"""
import sys, os, tempfile
sys.path.insert(0, "tests")
from vps_write import upload as sftp_upload  # noqa
from vps_ssh import run as ssh_exec  # noqa

FILES = [
    ("ykp-warehouse-v1/src/lib/stock-ledger.ts", "local"),
    ("ykp-warehouse-v1/src/lib/alert-dedupe.ts", "local"),
    ("ykp-warehouse-v1/src/app/api/warehouse/receiving/route.ts", "merge"),
    ("ykp-warehouse-v1/src/app/api/warehouse/batch-stock/route.ts", "merge"),
    ("ykp-finance-v1/src/lib/approval.ts", "local"),
    ("ykp-finance-v1/src/lib/concurrency.ts", "local"),
    ("ykp-finance-v1/src/app/api/finance/expenses/[id]/approve/route.ts", "local"),
    ("ykp-finance-v1/src/app/api/finance/petty-cash/[id]/approve/route.ts", "local"),
]

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VPS_ROOT = "/home/dev/ykp"


def read_local(rel):
    with open(os.path.join(REPO, rel), "r", encoding="utf-8") as f:
        return f.read()


def main():
    for rel, mode in FILES:
        local_path = os.path.join(REPO, rel)
        remote_path = f"{VPS_ROOT}/{rel}"
        vps_out, vps_err = ssh_exec(f"cat {remote_path} 2>/dev/null")
        vps = vps_out if vps_out else None
        if vps is None:
            # ensure remote dir exists
            remote_dir = os.path.dirname(remote_path)
            ssh_exec(f"mkdir -p {remote_dir}")
            print(f"[NEW] uploading {rel}")
            sftp_upload(local_path, remote_path)
            continue
        with open(local_path, "r", encoding="utf-8") as f:
            local = f.read()
        same = local.strip() == vps.strip()
        if mode == "local":
            if same:
                print(f"[SAME] {rel}")
            else:
                print(f"[PUT] {rel}")
                sftp_upload(local_path, remote_path)
        else:  # merge
            has_dev = ("createLinkCode" in vps) or ("telegramLinkCodes" in vps)
            if has_dev:
                print(f"[SKIP-DEV] {rel} — VPS has dev-only refs, needs manual merge")
            else:
                if same:
                    print(f"[SAME] {rel}")
                else:
                    print(f"[PUT] {rel} (no dev-only refs, safe overwrite)")
                    sftp_upload(local_path, remote_path)


if __name__ == "__main__":
    main()