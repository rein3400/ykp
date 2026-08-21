import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

apps = ['ykp-finance-v1', 'ykp-ops-v1', 'ykp-warehouse-v1', 'ykp-investor-v1', 'ykp-owner-v1']
for app in apps:
    cmd = f"echo '===== {app} ====='; cat /home/dev/ykp/{app}/.env 2>/dev/null"
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    print(stdout.read().decode())
    err = stderr.read().decode()
    if err:
        print('STDERR:', err)

ssh.close()
