"""Verify merged files landed on VPS with the expected features."""
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=20)


def run(cmd):
    _, o, e = c.exec_command(cmd)
    return o.read().decode() + e.read().decode()


checks = [
    ("warehouse signal line",
     "grep -n 'signal: AbortSignal' /home/dev/ykp/ykp-warehouse-v1/src/lib/telegram.ts"),
    ("warehouse resolveRecipients",
     "grep -n 'resolveRecipients' /home/dev/ykp/ykp-warehouse-v1/src/lib/telegram.ts"),
    ("warehouse createLinkCode",
     "grep -n 'createLinkCode' /home/dev/ykp/ykp-warehouse-v1/src/lib/telegram.ts"),
    ("finance guardedUpdateRow",
     "grep -n 'guardedUpdateRow' /home/dev/ykp/ykp-finance-v1/src/lib/telegram.ts"),
    ("finance ConcurrentUpdateError import",
     "grep -n 'ConcurrentUpdateError' /home/dev/ykp/ykp-finance-v1/src/lib/telegram.ts"),
    ("hr-v1 sheets telegramLinkCodes",
     "grep -c 'telegramLinkCodes' /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts"),
    ("finance sheets telegramLinkCodes",
     "grep -c 'telegramLinkCodes' /home/dev/ykp/ykp-finance-v1/src/db/sheets.ts"),
    ("investor sheets telegramLinkCodes",
     "grep -c 'telegramLinkCodes' /home/dev/ykp/ykp-investor-v1/src/db/sheets.ts"),
    ("ops sheets checklistSubmissions",
     "grep -c 'checklistSubmissions' /home/dev/ykp/ykp-ops-v1/src/db/sheets.ts"),
    ("ops sheets telegramLinkCodes",
     "grep -c 'telegramLinkCodes' /home/dev/ykp/ykp-ops-v1/src/db/sheets.ts"),
    ("warehouse sheets telegramLinkCodes",
     "grep -c 'telegramLinkCodes' /home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts"),
]
for label, cmd in checks:
    out = run(cmd).strip()
    print(f"[{label}] {cmd}\n  -> {out!r}")
c.close()