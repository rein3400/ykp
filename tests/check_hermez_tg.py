import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
sftp = c.open_sftp()
with sftp.open("/home/dev/ykp/ykp-hermez/src/telegram.ts", "r") as f:
    content = f.read().decode("utf-8", "replace")
print("Has createLinkCode:", "createLinkCode" in content)
print("Has telegramLinkCodes:", "telegramLinkCodes" in content)
print("--- VPS head ---")
print(content[:600])
sftp.close()
c.close()