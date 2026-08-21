import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# Login
cmd = "curl -s -m 10 -c /tmp/fin.cookie -X POST 'http://localhost:3009/api/auth/login' -H 'Content-Type: application/json' -d '{\"username\":\"owner\",\"password\":\"owner123\"}' -o /dev/null -w 'login=%{http_code}\n'"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
print(stdout.read().decode().strip())

# Regenerate summary for 2026-07-31
cmd2 = "curl -s -m 30 -b /tmp/fin.cookie -X POST 'http://localhost:3009/api/finance/summary/regenerate' -H 'Content-Type: application/json' -d '{\"date\":\"2026-07-31\"}' | head -c 800"
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=60)
print('=== regenerate ===')
print(stdout.read().decode())

ssh.close()
