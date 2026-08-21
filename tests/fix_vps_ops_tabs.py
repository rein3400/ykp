"""Patch VPS-only TABS entries for ops: telegramDeliveryLog + telegramLinkCodes.

These are referenced by VPS-only files (telegram.ts with dev-only link-code
feature, and notify telegram delivery log) but absent from TABS. Add entries
+ TAB_HEADERS so the VPS build compiles. The underlying sheet tabs are assumed
to exist (the VPS-only code writes to them); if a tab is missing in the sheet,
readTab returns [] gracefully (the route still compiles and runs).
"""
import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=30)
sftp = ssh.open_sftp()

ops_sheets = "/home/dev/ykp/ykp-ops-v1/src/db/sheets.ts"
with sftp.open(ops_sheets, "r") as f:
    src = f.read().decode("utf-8")

changed = False

if "telegramDeliveryLog" not in src:
    src = src.replace(
        "  hermezAlerts: 'ops_hermes_alert_log',",
        "  hermezAlerts: 'ops_hermes_alert_log',\n"
        "  telegramDeliveryLog: 'ops_telegram_delivery_log',\n"
        "  telegramLinkCodes: 'ops_telegram_link_code',",
    )
    changed = True
    print("[ADD] telegramDeliveryLog + telegramLinkCodes to TABS")

if "ops_telegram_delivery_log" not in src or "ops_telegram_link_code" not in src:
    # Add TAB_HEADERS entries before the closing brace of TAB_HEADERS.
    # Find the last entry block end (hermezAlerts header) and append after it.
    if "[TABS.telegramDeliveryLog]" not in src:
        # Insert after the hermezAlerts header block. Use the closing of that block.
        # The TAB_HEADERS ends with `};` after the last entry. Insert before the final `};`.
        marker = "  [TABS.hermezAlerts]:"
        if marker in src:
            idx = src.index(marker)
            # find the end of that block (next `\n  [TABS.` or `\n};`)
            # simpler: insert just before the final `\n};\n` that closes TAB_HEADERS
            end_idx = src.rfind("\n};\n")
            if end_idx > idx:
                insertion = (
                    "  [TABS.telegramDeliveryLog]: [\n"
                    "    'delivery_id', 'source_module', 'source_reference_id',\n"
                    "    'chat_id', 'status', 'message_id', 'error_message', 'sent_at',\n"
                    "  ],\n"
                    "  [TABS.telegramLinkCodes]: [\n"
                    "    'code', 'chat_id', 'employee_id', 'consumed_at', 'created_at',\n"
                    "  ],\n"
                )
                src = src[:end_idx] + "\n" + insertion + src[end_idx+1:]
                changed = True
                print("[ADD] TAB_HEADERS for telegramDeliveryLog + telegramLinkCodes")

if changed:
    with sftp.open(ops_sheets, "w") as f:
        f.write(src)
    print("[PATCHED] ops sheets.ts — added telegramDeliveryLog + telegramLinkCodes")
else:
    print("[SKIP] ops sheets.ts — entries already present")

sftp.close()
ssh.close()
print("DONE")