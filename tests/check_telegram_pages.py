import paramiko

HOST = "187.77.114.168"
USER = "dev"
PWD = "password"

apps = ["ykp-finance-v1", "ykp-warehouse-v1", "ykp-investor-v1", "ykp-owner-v1"]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PWD, timeout=30)

for app in apps:
    print(f"=== {app} ===")
    cmd = (
        f"find /home/dev/ykp/{app}/src/app -type d -name telegram 2>/dev/null; "
        f"find /home/dev/ykp/{app}/src/app -path '*telegram*' -name 'page.tsx' 2>/dev/null; "
        f"find /home/dev/ykp/{app}/src/app/api -path '*telegram*' -name 'route.ts' 2>/dev/null"
    )
    stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(out)
    else:
        print("(no telegram page/route)")
    if err:
        print("ERR:", err)

c.close()
