import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"

apps = [
    ("ykp-finance-v1", "ykp-finance-v1"),
    ("ykp-warehouse-v1", "ykp-warehouse"),
    ("ykp-investor-v1", "ykp-investor"),
    ("ykp-ops-v1", "ykp-ops"),
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=30)

for app_dir, pm2_name in apps:
    print(f"\n===== BUILD {app_dir} =====", flush=True)
    cmd = (
        f"export PATH={PATH}; "
        f"cd /home/dev/ykp/{app_dir} && "
        f"npm run build 2>&1 | tail -8"
    )
    stdin, stdout, stderr = c.exec_command(cmd, timeout=600)
    out = stdout.read().decode()
    print(out)
    exit_status = stdout.channel.recv_exit_status()
    print(f"build exit: {exit_status}", flush=True)
    if exit_status != 0:
        print(f"!!! BUILD FAILED for {app_dir}", flush=True)
        continue
    print(f"===== RESTART {pm2_name} =====", flush=True)
    cmd2 = f"export PATH={PATH}; pm2 restart {pm2_name} --update-env 2>&1 | grep -E 'Applying|✓|error'"
    stdin, stdout, stderr = c.exec_command(cmd2, timeout=60)
    print(stdout.read().decode())
    stdout.channel.recv_exit_status()

print("\nALL DONE")
c.close()
