"""Add telegramLinkCodes (and for HR: investorUsers/opsUsers) to VPS sheets.ts
for hr/warehouse/investor so the TS build passes. Finance+ops already have it.

We mirror finance's definition:
  TABS.telegramLinkCodes = 'telegram_link_codes'
  TAB_HEADERS[TABS.telegramLinkCodes] = ['code','user_id','expires_at','telegram_chat_id','consumed_at','created_at','division']
HR additionally gets investorUsers/opsUsers (cross-division, .catch-guarded).
"""
import paramiko, sys

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)

LINKCODES_HDR = "['code', 'user_id', 'expires_at', 'telegram_chat_id', 'consumed_at', 'created_at', 'division']"

def patch(path, add_cross=False):
    sftp = c.open_sftp()
    try:
        with sftp.open(path, "r") as f:
            src = f.read().decode()
    except Exception as e:
        print(f"{path}: SFTP read error: {e}")
        return
    finally:
        sftp.close()
    if not src:
        print(f"{path}: empty read — skip")
        return
    if "telegramLinkCodes" in src:
        print(f"{path}: already has telegramLinkCodes — skip")
        return
    # Insert into TABS object before "} as const;"
    # Normalize CRLF handling: the file may use \r\n. Detect and use the
    # file's actual EOL when building markers.
    eol = "\r\n" if "\r\n" in src else "\n"
    insert_line = (
        "  telegramLinkCodes: 'telegram_link_codes'"
        + (f",{eol}  investorUsers: 'master_investor_users',{eol}  opsUsers: 'master_ops_users'" if add_cross else "")
    )
    # Marker A: "} as const;<EOL><EOL>export type TabName"
    mA = f"}} as const;{eol}{eol}export type TabName"
    # Marker B: "} as const;<EOL>export type TabName"
    mB = f"}} as const;{eol}export type TabName"
    if mA in src:
        print(f"{path}: using marker A (blank line)")
        src = src.replace(mA, insert_line + eol + mA, 1)
    elif mB in src:
        print(f"{path}: using marker B (no blank line)")
        src = src.replace(mB, insert_line + eol + mB, 1)
    else:
        print(f"{path}: TABS marker not found — SKIP")
        # debug
        print(f"  eol={repr(eol)} mA={repr(mA[:40])} mB={repr(mB[:40])}")
        idx = src.find("} as const;")
        print(f"  region={repr(src[idx:idx+60])}")
        return

    # Insert TAB_HEADERS — find the closing "];" of the LAST header block before "};"
    # Strategy: insert right before "};" that ends TAB_HEADERS.
    # Find first occurrence of a header entry to anchor; use "[TABS.users]:" as anchor.
    anchor = "  [TABS.users]:"
    if anchor not in src:
        print(f"{path}: TAB_HEADERS anchor not found — SKIP headers (TABS added, may fail)")
    else:
        # insert before the [TABS.users] block
        hdr_block = (
            "  [TABS.telegramLinkCodes]: " + LINKCODES_HDR + f",{eol}"
        )
        if add_cross:
            hdr_block += (
                f"  [TABS.investorUsers]: ['user_id', 'username', 'role', 'telegram_id', 'active_status'],{eol}"
                f"  [TABS.opsUsers]: ['user_id', 'username', 'role', 'telegram_id', 'active_status'],{eol}"
            )
        src = src.replace(anchor, hdr_block + anchor, 1)

    sftp = c.open_sftp()
    with sftp.open(path, "w") as f:
        f.write(src)
    sftp.close()
    print(f"{path}: PATCHED (cross={add_cross})")

patch("/home/dev/ykp/ykp-hr-v1/src/db/sheets.ts", add_cross=True)
patch("/home/dev/ykp/ykp/ykp-warehouse-v1/src/db/sheets.ts", add_cross=False)
patch("/home/dev/ykp/ykp-investor-v1/src/db/sheets.ts", add_cross=False)

c.close()