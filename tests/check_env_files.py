import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cmd = "ls -la /home/dev/ykp/ykp-hr-v1/ | grep -i 'env'"
stdin, stdout, stderr = ssh.exec_command(cmd)
print('LS:', stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:', err)

cmd2 = "grep -H 'YKP_HR_SPREADSHEET_ID' /home/dev/ykp/ykp-hr-v1/.env /home/dev/ykp/ykp-hr-v1/.env.production /home/dev/ykp/ykp-hr-v1/.env.local 2>/dev/null"
stdin, stdout, stderr = ssh.exec_command(cmd2)
print('IDS:', stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR2:', err)
ssh.close()
