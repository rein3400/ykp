import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# Check HR-v1 findRow implementation
cmd = "grep -n 'findRow' -A 30 /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts | head -50"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
print('=== HR-v1 findRow ===')
print(stdout.read().decode())

ssh.close()
