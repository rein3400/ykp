"""Merge the 7 SKIP-DEV files and upload merged versions to VPS.

Merge rules (verified by set-diff):
  - 5 sheets.ts: VPS is a strict superset of local (VPS = local + new TAB
    entries). Merged = VPS version verbatim.
  - finance telegram.ts: local has race-free consumeLinkCode (guardedUpdateRow)
    that VPS lacks; VPS has nothing local lacks. VPS already has concurrency.ts.
    Merged = LOCAL version verbatim.
  - warehouse telegram.ts: VPS has resolveRecipients/createLinkCode that local
    lacks; local has `signal: AbortSignal.timeout(10000)` (fix #15) that VPS
    lacks. Merged = VPS version + re-insert the AbortSignal line into the
    fetch call.

After upload: build + restart hr-v1, finance-v1, investor-v1, ops-v1,
warehouse-v1. Then re-run audit_deploy_gap.py to confirm 0 DIFF / 0 SKIP-DEV.
"""
import os
import paramiko
from paramiko import SSHClient

HOST = "187.77.114.168"
USER = "dev"
PWD = "password"
BASE = os.path.dirname(os.path.abspath(__file__))
REV = os.path.join(BASE, "..", "rev")

# (merged-filename, vps-path, mode)
#  mode = "vps"  -> copy VPS verbatim
#  mode = "local"-> copy LOCAL verbatim
#  mode = "wh-tg"-> VPS + insert AbortSignal line
FILES = [
    ("ykp-hr-v1__src__db__sheets.ts",        "/home/dev/ykp/ykp-hr-v1/src/db/sheets.ts",        "vps"),
    ("ykp-finance-v1__src__db__sheets.ts",   "/home/dev/ykp/ykp-finance-v1/src/db/sheets.ts",   "vps"),
    ("ykp-investor-v1__src__db__sheets.ts",  "/home/dev/ykp/ykp-investor-v1/src/db/sheets.ts",  "vps"),
    ("ykp-ops-v1__src__db__sheets.ts",       "/home/dev/ykp/ykp-ops-v1/src/db/sheets.ts",       "vps"),
    ("ykp-warehouse-v1__src__db__sheets.ts", "/home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts", "vps"),
    ("ykp-finance-v1__src__lib__telegram.ts","/home/dev/ykp/ykp-finance-v1/src/lib/telegram.ts","local"),
    ("ykp-warehouse-v1__src__lib__telegram.ts","/home/dev/ykp/ykp-warehouse-v1/src/lib/telegram.ts","wh-tg"),
]

MERGED_DIR = os.path.join(REV, "merged")
os.makedirs(MERGED_DIR, exist_ok=True)


def build_merged(name: str, mode: str) -> bytes:
    """Return merged file bytes (preserve CRLF)."""
    if mode == "vps":
        with open(os.path.join(REV, "vps", name), "rb") as f:
            return f.read()
    if mode == "local":
        with open(os.path.join(REV, "local", name), "rb") as f:
            return f.read()
    if mode == "wh-tg":
        with open(os.path.join(REV, "vps", name), "rb") as f:
            data = f.read()
        # VPS uses CRLF. The fetch block:
        #   ...body: JSON.stringify({ chat_id: chatId, text: msg.text, parse_mode: 'HTML' })\r\n
        #   });\r\n
        # Insert a comment + signal line before the closing `});`.
        old = (b"        body: JSON.stringify({ chat_id: chatId, text: msg.text, "
               b"parse_mode: 'HTML' })\r\n      });\r\n")
        new = (b"        body: JSON.stringify({ chat_id: chatId, text: msg.text, "
               b"parse_mode: 'HTML' }),\r\n"
               b"        // 10s cap so a hanging Telegram API can't stall the route/cron to the\r\n"
               b"        // platform timeout.\r\n"
               b"        signal: AbortSignal.timeout(10000)\r\n"
               b"      });\r\n")
        if old not in data:
            raise RuntimeError(f"warehouse telegram.ts: anchor not found in {name}")
        merged = data.replace(old, new, 1)
        return merged
    raise ValueError(mode)


def main() -> None:
    # Build merged files locally first (so we can inspect before upload).
    merged_blobs = {}
    for name, path, mode in FILES:
        blob = build_merged(name, mode)
        merged_blobs[name] = blob
        out = os.path.join(MERGED_DIR, name)
        with open(out, "wb") as f:
            f.write(blob)
        print(f"[merged] {name} ({mode}) -> {out} ({len(blob)} bytes)")

    # Upload to VPS.
    ssh = SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PWD, timeout=30)
    sftp = ssh.open_sftp()
    for name, vps_path, mode in FILES:
        blob = merged_blobs[name]
        # Backup current VPS file first.
        bak = vps_path + ".pre-merge.bak"
        try:
            sftp.put(vps_path, "/tmp/_cur_skip.bak")
            with sftp.file(bak, "wb") as f:
                f.write(sftp.file("/tmp/_cur_skip.bak", "rb").read())
        except IOError as e:
            print(f"[backup-skip] {vps_path}: {e}")
        sftp.putfo(__import__("io").BytesIO(blob), vps_path)
        print(f"[upload] {name} -> {vps_path} ({len(blob)} bytes)")
    sftp.close()
    ssh.close()
    print("DONE build+upload. Run tests/restart_v1_apps.py next.")


if __name__ == "__main__":
    main()