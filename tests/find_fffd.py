import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
sftp = c.open_sftp()
with sftp.open("/home/dev/ykp/ykp-warehouse-v1/src/lib/telegram.ts", "r") as f:
    src = f.read().decode("utf-8")
for i, line in enumerate(src.splitlines(), 1):
    if "\uFFFD" in line:
        print(f"{i}: {line[:120]}")
c.close()