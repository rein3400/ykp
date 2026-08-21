"""Upload a python patch script to VPS and run it there — avoids paramiko read issues
with the warehouse sheets.ts file.

Patches hr/warehouse/investor sheets.ts to add telegramLinkCodes (and for hr
also investorUsers/opsUsers) so the TS build passes.
"""
import paramiko, textwrap

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)

script = r'''
import re

LINKCODES_HDR = "['code', 'user_id', 'expires_at', 'telegram_chat_id', 'consumed_at', 'created_at', 'division']"

def patch(path, add_cross=False):
    with open(path, "rb") as f:
        raw = f.read()
    src = raw.decode("utf-8")
    if "telegramLinkCodes" in src:
        print(f"{path}: already has telegramLinkCodes -- skip")
        return
    eol = "\r\n" if "\r\n" in src else "\n"
    insert_line = (
        "  telegramLinkCodes: 'telegram_link_codes'"
        + (f",{eol}  investorUsers: 'master_investor_users',{eol}  opsUsers: 'master_ops_users'" if add_cross else "")
    )
    mA = f"}} as const;{eol}{eol}export type TabName"
    mB = f"}} as const;{eol}export type TabName"
    if mA in src:
        print(f"{path}: marker A")
        src = src.replace(mA, insert_line + eol + mA, 1)
    elif mB in src:
        print(f"{path}: marker B")
        src = src.replace(mB, insert_line + eol + mB, 1)
    else:
        print(f"{path}: marker not found -- skip")
        return
    # TAB_HEADERS: insert before "[TABS.users]:" anchor
    anchor = "  [TABS.users]:"
    if anchor in src:
        hdr_block = "  [TABS.telegramLinkCodes]: " + LINKCODES_HDR + f",{eol}"
        if add_cross:
            hdr_block += (
                f"  [TABS.investorUsers]: ['user_id', 'username', 'role', 'telegram_id', 'active_status'],{eol}"
                f"  [TABS.opsUsers]: ['user_id', 'username', 'role', 'telegram_id', 'active_status'],{eol}"
            )
        src = src.replace(anchor, hdr_block + anchor, 1)
    else:
        print(f"{path}: TAB_HEADERS anchor not found (headers not added)")
    with open(path, "wb") as f:
        f.write(src.encode("utf-8"))
    print(f"{path}: PATCHED (cross={add_cross})")

patch("/home/dev/ykp/ykp-hr-v1/src/db/sheets.ts", add_cross=True)
patch("/home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts", add_cross=False)
patch("/home/dev/ykp/ykp-investor-v1/src/db/sheets.ts", add_cross=False)
'''

sftp = c.open_sftp()
with sftp.open("/tmp/patch_linkcodes.py", "w") as f:
    f.write(script)
sftp.close()
_, out, err = c.exec_command("python3 /tmp/patch_linkcodes.py")
print(out.read().decode())
e = err.read().decode()
if e:
    print("ERR:", e)
c.close()