"""Build + restart the 5 fixed V1 apps on the VPS, sequentially.

Apps: hr-v1, finance-v1, warehouse-v1, investor-v1, ops-v1
Each: npm run build (timeout 600s) then pm2 restart --update-env.
Stops on first build failure.
"""
import paramiko, sys

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"
PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"

# (repo dir, pm2 name)
apps = [
    ("ykp-hr-v1", "ykp-hr-v1"),
    ("ykp-finance-v1", "ykp-finance-v1"),
    ("ykp-warehouse-v1", "ykp-warehouse"),
    ("ykp-investor-v1", "ykp-investor"),
    ("ykp-ops-v1", "ykp-ops"),
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=30)

failures = []
for app_dir, pm2_name in apps:
    print(f"\n===== BUILD {app_dir} =====", flush=True)
    cmd = (
        f"export PATH={PATH}; "
        f"cd /home/dev/ykp/{app_dir} && "
        f"npm run build 2>&1 | tail -12"
    )
    stdin, stdout, stderr = c.exec_command(cmd, timeout=900)
    out = stdout.read().decode()
    status = stdout.channel.recv_exit_status()
    print(out)
    print(f"build exit: {status}", flush=True)
    if status != 0:
        print(f"!!! BUILD FAILED for {app_dir}", flush=True)
        failures.append(app_dir)
        # continue to next app — we still want to know which others fail
        continue
    print(f"===== RESTART {pm2_name} =====", flush=True)
    cmd2 = f"export PATH={PATH}; pm2 restart {pm2_name} --update-env 2>&1 | tail -4"
    stdin, stdout, stderr = c.exec_command(cmd2, timeout=60)
    print(stdout.read().decode())
    stdout.channel.recv_exit_status()

print("\n===== SUMMARY =====")
if failures:
    print(f"FAILED: {', '.join(failures)}")
    sys.exit(1)
print("ALL 5 BUILDS + RESTARTS OK")
c.close()