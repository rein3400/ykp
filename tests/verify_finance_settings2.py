import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# login with full body capture
cmd = "curl -s -m 10 -c /tmp/fin.cookie -X POST 'http://localhost:3009/api/auth/login' -H 'Content-Type: application/json' -d '{\"username\":\"owner\",\"password\":\"owner123\"}' -w '\\nHTTP=%{http_code}\\n'"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
print('=== login ===')
print(stdout.read().decode())

# GET settings
cmd2 = "curl -s -m 10 -b /tmp/fin.cookie 'http://localhost:3009/api/finance/settings' -w '\\nHTTP=%{http_code}\\n'"
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=30)
print('=== GET settings ===')
print(stdout.read().decode())

# POST settings
cmd3 = "curl -s -m 10 -b /tmp/fin.cookie -X POST 'http://localhost:3009/api/finance/settings' -H 'Content-Type: application/json' -d '{\"key\":\"telegram_owner_chat_id\",\"value\":\"5721500978\",\"description\":\"Owner chat id\"}' -w '\\nHTTP=%{http_code}\\n'"
stdin, stdout, stderr = ssh.exec_command(cmd3, timeout=30)
print('=== POST settings ===')
print(stdout.read().decode())

# GET settings again
cmd4 = "curl -s -m 10 -b /tmp/fin.cookie 'http://localhost:3009/api/finance/settings' -w '\\nHTTP=%{http_code}\\n'"
stdin, stdout, stderr = ssh.exec_command(cmd4, timeout=30)
print('=== GET settings after POST ===')
print(stdout.read().decode())

ssh.close()
