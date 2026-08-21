import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cmd = "curl -s -m 10 -c /tmp/fin.cookie -X POST 'http://localhost:3009/api/auth/login' -H 'Content-Type: application/json' -d '{\"username\":\"owner\",\"password\":\"owner123\"}' -o /dev/null -w 'login=%{http_code}\n'"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
print(stdout.read().decode().strip())

cmd2 = "curl -s -m 10 -b /tmp/fin.cookie 'http://localhost:3009/api/finance/summary?date=2026-07-31&outlet_id=OL-003' | head -c 1500"
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=30)
print('=== summary OL-003 ===')
print(stdout.read().decode())

ssh.close()
