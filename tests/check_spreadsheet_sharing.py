import paramiko

HOST = "187.77.114.168"
USER = "dev"
PWD = "password"

apps = ["ykp-hr-v1", "ykp-finance-v1", "ykp-warehouse-v1", "ykp-investor-v1", "ykp-ops-v1"]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PWD, timeout=30)

for app in apps:
    print(f"=== {app} ===")
    cmd = (
        f"grep -E 'SPREADSHEET_ID|TELEGRAM_BOT_TOKEN|TELEGRAM_BOT_SECRET|NEXT_PUBLIC_TELEGRAM_BOT_USERNAME|TELEGRAM_WEBHOOK_SECRET' "
        f"/home/dev/ykp/{app}/.env 2>/dev/null"
    )
    stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
    out = stdout.read().decode().strip()
    print(out if out else "(no env)")

c.close()
