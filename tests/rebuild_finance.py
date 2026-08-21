import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-finance-v1 && npm run build 2>&1 | tail -15"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=600)
print('=== build ===')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
