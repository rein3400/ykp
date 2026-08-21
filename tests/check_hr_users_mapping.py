import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cmd = "grep -n 'users:' -A 4 /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts | head -12"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
print('=== hr-v1 TABS users ===')
print(stdout.read().decode())

cmd2 = "grep -n 'TABS.users' -A 3 /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts | head -12"
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=30)
print('=== hr-v1 TAB_HEADERS users ===')
print(stdout.read().decode())

ssh.close()
