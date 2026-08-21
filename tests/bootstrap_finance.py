import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-finance-v1 && npm run sheets:bootstrap 2>&1 | tail -40"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
print('=== bootstrap ===')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
