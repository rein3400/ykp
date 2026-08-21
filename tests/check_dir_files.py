"""Check specific files/dirs on VPS: settings dir, telegram-actor dir,
openrouter (deleted local), and whether the 29 DIFF files actually differ
(throw away whitespace-only diffs)."""
import os, paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
sftp = c.open_sftp()
ROOT = "/home/dev/ykp"

checks = [
    "ykp-finance-v1/src/app/api/finance/settings/route.ts",
    "ykp-hr-v1/src/app/api/hr/telegram-actor/route.ts",
    "ykp-hr-v1/src/app/api/hr/telegram-actor/route.test.ts",
    "ykp-hermez/src/openrouter.ts",
    "ykp-finance-v1/src/lib/concurrency.ts",
    "ykp-finance-v1/src/lib/settings.ts",
]
for rel in checks:
    try:
        st = sftp.stat(f"{ROOT}/{rel}")
        print(f"VPS-HAS {rel}  ({st.st_size} bytes)")
    except IOError:
        print(f"VPS-MISSING {rel}")

sftp.close()
c.close()