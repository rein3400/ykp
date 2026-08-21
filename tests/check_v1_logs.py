import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# Check recent logs for sheets errors
for app in ['ykp-finance-v1', 'ykp-ops', 'ykp-warehouse', 'ykp-investor']:
    cmd = f"export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; echo '=== {app} log ==='; pm2 logs {app} --lines 15 --nostream 2>/dev/null | tail -20"
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    print(stdout.read().decode())

ssh.close()
