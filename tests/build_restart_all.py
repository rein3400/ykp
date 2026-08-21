import paramiko
import time

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=30)

PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"

apps = [
    ("ykp-hr-v1", "ykp-hr-v1"),
    ("ykp-finance-v1", "ykp-finance-v1"),
    ("ykp-warehouse-v1", "ykp-warehouse"),
    ("ykp-investor-v1", "ykp-investor"),
    ("ykp-ops-v1", "ykp-ops"),
]

for app_dir, pm2_name in apps:
    print(f"\n===== BUILD {app_dir} =====", flush=True)
    cmd = (
        f"export PATH={PATH}; "
        f"cd /home/dev/ykp/{app_dir} && "
        f"npm run build 2>&1 | tail -30"
    )
    stdin, stdout, stderr = c.exec_command(cmd, timeout=600)
    out = stdout.read().decode()
    err = stderr.read().decode()
    print(out)
    if err.strip():
        print("STDERR:", err)
    # check exit status via channel
    exit_status = stdout.channel.recv_exit_status()
    print(f"build exit: {exit_status}", flush=True)
    if exit_status != 0:
        print(f"!!! BUILD FAILED for {app_dir}, skipping restart", flush=True)
        continue

    print(f"===== RESTART {pm2_name} =====", flush=True)
    cmd2 = f"export PATH={PATH}; pm2 restart {pm2_name} --update-env 2>&1"
    stdin, stdout, stderr = c.exec_command(cmd2, timeout=60)
    out2 = stdout.read().decode()
    print(out2)
    stdout.channel.recv_exit_status()

print("\nALL DONE")
c.close()
