import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; pm2 env 4"
stdin, stdout, stderr = ssh.exec_command(cmd)
out = stdout.read().decode()
print(out[:3000])
err = stderr.read().decode()
if err:
    print('STDERR:', err)
ssh.close()
