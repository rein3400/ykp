"""Insert TAB_HEADERS entries for telegramDeliveryLog + telegramLinkCodes in ops VPS.

The previous patch added TABS entries but the TAB_HEADERS insertion failed
(the rfind logic missed). This does a precise replace on the closing of the
hermezAlerts header block + the `};` that ends TAB_HEADERS.
"""
import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=30)
sftp = ssh.open_sftp()

path = "/home/dev/ykp/ykp-ops-v1/src/db/sheets.ts"
with sftp.open(path, "r") as f:
    src = f.read().decode("utf-8")

# The hermezAlerts header block ends with:
#     'outlet_id', 'status', 'created_at',
#   ],
# };
# We insert our two new header blocks between `],` and `};`.
old = "    'outlet_id', 'status', 'created_at',\n  ],\n};"
new = (
    "    'outlet_id', 'status', 'created_at',\n  ],\n"
    "  [TABS.telegramDeliveryLog]: [\n"
    "    'delivery_id', 'source_module', 'source_reference_id',\n"
    "    'chat_id', 'status', 'message_id', 'error_message', 'sent_at',\n"
    "  ],\n"
    "  [TABS.telegramLinkCodes]: [\n"
    "    'code', 'chat_id', 'employee_id', 'consumed_at', 'created_at',\n"
    "  ],\n"
    "};"
)

if "[TABS.telegramDeliveryLog]:" in src:
    print("[SKIP] headers already present")
else:
    if old not in src:
        print("[ERR] anchor not found — manual edit needed")
        import sys; sys.exit(1)
    src = src.replace(old, new, 1)
    with sftp.open(path, "w") as f:
        f.write(src)
    print("[PATCHED] inserted TAB_HEADERS for telegramDeliveryLog + telegramLinkCodes")

sftp.close()
ssh.close()
print("DONE")