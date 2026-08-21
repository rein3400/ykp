import paramiko

HOST = "187.77.114.168"
USER = "dev"
PWD = "password"

files = [
    "/home/dev/ykp/ykp-finance-v1/src/components/sidebar.tsx",
    "/home/dev/ykp/ykp-warehouse-v1/src/components/sidebar.tsx",
    "/home/dev/ykp/ykp-investor-v1/src/components/sidebar.tsx",
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PWD, timeout=30)

for f in files:
    print(f"=== {f} ===")
    stdin, stdout, stderr = c.exec_command(f"grep -n 'Telegram\\|telegram' {f}", timeout=30)
    out = stdout.read().decode().strip()
    print(out if out else "(no telegram item)")

c.close()
