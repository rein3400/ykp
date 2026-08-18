import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cmd = r"""
export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
PID=$(pm2 pid ykp-hr-v1)
echo "PID: $PID"
cat /proc/$PID/environ | tr '\0' '\n' | grep -iE 'USE_MOCK|TELEGRAM|GOOGLE_SERVICE|SPREADSHEET'
"""
stdin, stdout, stderr = ssh.exec_command(cmd)
print('STDOUT:\n' + stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:\n' + err)
ssh.close()
