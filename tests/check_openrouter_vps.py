"""Check if openrouter is referenced anywhere in VPS ykp-hermez/src."""
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"
cmd = f"export PATH={PATH}; grep -rn openrouter /home/dev/ykp/ykp-hermez/src/ 2>&1 || echo 'NO MATCH'"
stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
print(stdout.read().decode("utf-8", "replace"))
c.close()