import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
for a in ["ykp-warehouse-v1","ykp-investor-v1"]:
    p = f"/home/dev/ykp/{a}/src/lib/telegram.ts"
    _, out, _ = c.exec_command(f"grep -oE 'TABS\\.[a-zA-Z]+' {p} | sort -u")
    print(f"=== {a} ===")
    print(out.read().decode())
c.close()