"""Read recent ykp-hr-v1 PM2 logs to confirm the /masuk-no-loc webhook
took the missing-location path (asked for location, no 500, no error)."""
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin; pm2 logs ykp-hr-v1 --lines 30 --nostream 2>&1"
stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
print(stdout.read().decode("utf-8", errors="replace"))
c.close()