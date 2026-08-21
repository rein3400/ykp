import paramiko

HOST = "187.77.114.168"
USER = "dev"
PWD = "password"

path = "/home/dev/ykp/ykp-hub/.env"
old = "NEXT_PUBLIC_YKP_HR_URL=https://hr.oseedigital.tech"
new = "NEXT_PUBLIC_YKP_HR_URL=https://hr-v1.oseedigital.tech"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PWD, timeout=30)
sftp = c.open_sftp()
with sftp.open(path, "r") as f:
    content = f.read().decode("utf-8")
n = content.count(old)
if n != 1:
    print(f"FAIL: pattern count={n}")
else:
    content = content.replace(old, new)
    with sftp.open(path, "w") as f:
        f.write(content)
    print("OK: HR URL updated to hr-v1")
sftp.close()
c.close()
