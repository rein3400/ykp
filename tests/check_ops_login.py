import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# Mock DB enabled - check sheets for owner user
cmd = "find /home/dev/ykp/ykp-ops-v1/src -name 'auth*.ts' -o -name 'session*.ts' | head -5"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
print('auth files:', stdout.read().decode())

cmd2 = "grep -rn 'owner123\\|hash\\|password' /home/dev/ykp/ykp-ops-v1/src/lib/auth.ts /home/dev/ykp/ykp-ops-v1/src/lib/session.ts 2>/dev/null | head -20"
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=30)
print('--- auth/session ---')
print(stdout.read().decode())

# Check sheets for users tab
cmd3 = "curl -s -X POST 'http://localhost:3007/api/auth/login' -H 'Content-Type: application/json' -d '{\"username\":\"owner\",\"password\":\"owner123\"}'"
stdin, stdout, stderr = ssh.exec_command(cmd3, timeout=30)
print('--- login API direct ---')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()