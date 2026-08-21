import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=20)


def run(cmd):
    _, o, e = c.exec_command(cmd)
    return o.read().decode() + e.read().decode()


print("=== bot tokens (first 20 chars) ===")
for app in ["ykp-hr-v1", "ykp-finance-v1", "ykp-warehouse-v1",
            "ykp-ops-v1", "ykp-investor-v1", "ykp-hermez"]:
    cmd = ("grep 'TELEGRAM_BOT_TOKEN=' /home/dev/ykp/" + app +
           "/.env 2>/dev/null | cut -d= -f2 | cut -c1-25")
    print(app, "->", run(cmd).strip())

print("\n=== bot usernames ===")
for app in ["ykp-hr-v1", "ykp-finance-v1", "ykp-warehouse-v1",
            "ykp-ops-v1", "ykp-investor-v1", "ykp-hermez"]:
    cmd = ("grep 'NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=' /home/dev/ykp/" + app +
           "/.env 2>/dev/null | cut -d= -f2")
    print(app, "->", run(cmd).strip())
c.close()