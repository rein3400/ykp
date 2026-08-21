"""Rebuild + restart only hr-v1, warehouse, investor (the 3 that were 502)."""
import paramiko, sys

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"

apps = [
    ("ykp-warehouse-v1", "ykp-warehouse"),
    ("ykp-investor-v1", "ykp-investor"),
    ("ykp-hr-v1", "ykp-hr-v1"),
]
fail = []
for app_dir, pm2 in apps:
    print(f"\n===== BUILD {app_dir} =====", flush=True)
    cmd = f"export PATH={PATH}; cd /home/dev/ykp/{app_dir} && npm run build 2>&1 | tail -15"
    _, out, _ = c.exec_command(cmd, timeout=900)
    status = out.channel.recv_exit_status()
    print(out.read().decode())
    print(f"build exit: {status}")
    if status != 0:
        fail.append(app_dir); continue
    print(f"===== RESTART {pm2} =====")
    _, out, _ = c.exec_command(f"export PATH={PATH}; pm2 restart {pm2} --update-env 2>&1 | tail -3", timeout=60)
    print(out.read().decode())
    out.channel.recv_exit_status()

print("\nSUMMARY:", "FAIL: "+str(fail) if fail else "ALL 3 OK")
c.close()