"""Add the missing telegramLinkCodes/investorUsers/opsUsers tabs to VPS HR sheets.ts
so the TS build passes (telegram-link dev feature references these TABS keys).

We add:
  TABS.telegramLinkCodes = 'telegram_link_codes'
  TABS.investorUsers = 'master_investor_users'   (cross-division lookup, .catch-guarded)
  TABS.opsUsers = 'master_ops_users'             (same)
and matching TAB_HEADERS entries.
"""
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)

path = "/home/dev/ykp/ykp-hr-v1/src/db/sheets.ts"
_, out, _ = c.exec_command(f"cat {path}")
src = out.read().decode()

# 1) Add to TABS object — insert before closing "} as const;" of TABS
tabs_marker = "  telegramDeliveryLog: 'telegram_delivery_log'\n} as const;"
tabs_insert = (
    "  telegramDeliveryLog: 'telegram_delivery_log',\n"
    "  // Telegram link-code binding (dev feature; .catch-guarded at call sites)\n"
    "  telegramLinkCodes: 'telegram_link_codes',\n"
    "  // Cross-division user lookups for consumeLinkCode (HR app falls back to\n"
    "  // TABS.users; these exist so TS compiles when division is investor/ops).\n"
    "  investorUsers: 'master_investor_users',\n"
    "  opsUsers: 'master_ops_users'\n"
    "} as const;"
)
if tabs_marker not in src:
    print("TABS marker not found — aborting"); raise SystemExit(1)
src = src.replace(tabs_marker, tabs_insert, 1)

# 2) Add TAB_HEADERS entries — insert right after the "[TABS.brands]" line's opening,
#    simplest: insert before "[TABS.outlets]" header block.
# Find the outlets header block start.
hdr_marker = "  [TABS.outlets]: ["
hdr_insert = (
    "  [TABS.telegramLinkCodes]: ['code', 'user_id', 'expires_at', 'telegram_chat_id', 'consumed_at', 'created_at', 'division'],\n"
    "  [TABS.investorUsers]: ['user_id', 'username', 'role', 'telegram_id', 'active_status'],\n"
    "  [TABS.opsUsers]: ['user_id', 'username', 'role', 'telegram_id', 'active_status'],\n"
    "  [TABS.outlets]: ["
)
if hdr_marker not in src:
    print("TAB_HEADERS marker not found — aborting"); raise SystemExit(1)
src = src.replace(hdr_marker, hdr_insert, 1)

# Write back
sftp = c.open_sftp()
with sftp.open(path, "w") as f:
    f.write(src)
sftp.close()
print("Patched HR sheets.ts with 3 new TABS keys + headers")

# Verify
_, out, _ = c.exec_command(f"grep -c 'telegramLinkCodes\\|investorUsers\\|opsUsers' {path}")
print("occurrences:", out.read().decode().strip())
c.close()