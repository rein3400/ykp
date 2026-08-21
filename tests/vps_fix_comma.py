"""Fix the missing comma syntax error introduced by the linkcodes patch.

The patch inserted "telegramLinkCodes: 'telegram_link_codes'" right after the
last TABS entry (which had no trailing comma). Result:
    legacyAlerts: 'hermes_alert_log'
    telegramLinkCodes: 'telegram_link_codes'
} as const;   <- syntax error (two properties, no comma)

Fix: ensure the property BEFORE telegramLinkCodes ends with a comma.
Also ensure telegramLinkCodes has a trailing comma (in case more props get
added later). Do this for hr/warehouse/investor sheets.ts.
"""
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)

script = r'''
import re
for path in [
    "/home/dev/ykp/ykp-hr-v1/src/db/sheets.ts",
    "/home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts",
    "/home/dev/ykp/ykp-investor-v1/src/db/sheets.ts",
]:
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()
    # Pattern: <some prop>: <value>  (NO comma, end of line)  followed by
    #   telegramLinkCodes: ... (NO comma) followed by } as const;
    # We add a comma after the line that precedes telegramLinkCodes, and a
    # trailing comma on the telegramLinkCodes line itself.
    # Use regex: capture the line before telegramLinkCodes.
    pat = re.compile(
        r"(\n  [A-Za-z_]+: '[^']+'\s*)(\n  telegramLinkCodes: 'telegram_link_codes')(\s*)(\n\} as const;)",
        re.MULTILINE,
    )
    new = pat.sub(
        lambda m: m.group(1) + "," + m.group(2) + "," + m.group(3) + m.group(4),
        src,
    )
    if new == src:
        # try without the capture group 3 (whitespace may vary)
        pat2 = re.compile(
            r"(\n  [A-Za-z_]+: '[^']+'\s*)\n(  telegramLinkCodes: 'telegram_link_codes')\n(\} as const;)",
            re.MULTILINE,
        )
        new = pat2.sub(
            lambda m: m.group(1) + ",\n" + m.group(2) + ",\n" + m.group(3),
            src,
        )
    if new == src:
        print(f"{path}: no fix needed (pattern not found)")
        continue
    with open(path, "w", encoding="utf-8") as f:
        f.write(new)
    print(f"{path}: FIXED comma")
    # show the region
    idx = new.find("telegramLinkCodes")
    print("  region:", repr(new[idx-60:idx+80]))
'''

sftp = c.open_sftp()
with sftp.open("/tmp/fix_comma.py", "w") as f:
    f.write(script)
sftp.close()
_, out, err = c.exec_command("python3 /tmp/fix_comma.py")
print(out.read().decode())
e = err.read().decode()
if e:
    print("ERR:", e)
c.close()