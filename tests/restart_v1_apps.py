import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; pm2 restart ykp-finance-v1 ykp-ops-v1 ykp-warehouse-v1 ykp-investor-v1 2>&1"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
print(stdout.read().decode())
print(stderr.read().decode())

time.sleep(5)

# Verify status
cmd2 = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; pm2 list 2>/dev/null | grep -E 'ykp-finance-v1|ykp-ops-v1|ykp-warehouse-v1|ykp-investor-v1'"
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=30)
print(stdout.read().decode())

ssh.close()
