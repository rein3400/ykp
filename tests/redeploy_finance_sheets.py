import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

sftp = ssh.open_sftp()
sftp.put('ykp-finance-v1/src/db/sheets.ts', '/home/dev/ykp/ykp-finance-v1/src/db/sheets.ts')
print('UPLOADED finance sheets.ts')
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-finance-v1 && npm run build 2>&1 | tail -8"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=600)
print('=== finance build ===')
print(stdout.read().decode())
print(stderr.read().decode())

cmd2 = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; pm2 restart ykp-finance-v1 --update-env 2>&1 | tail -3"
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=60)
print('=== finance restart ===')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
