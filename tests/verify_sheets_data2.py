import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# Login to each app and hit data endpoints with session cookie
apps = [
    ('finance-v1', 3009, '/api/auth/login', 'owner', 'owner123', '/api/finance/summary'),
    ('ops', 3007, '/api/auth/login', 'owner', 'owner123', '/api/ops/summary'),
    ('warehouse', 3005, '/api/auth/login', 'owner', 'owner123', '/api/warehouse/summary'),
    ('investor', 3006, '/api/auth/login', 'owner', 'owner123', '/api/investor/summary'),
]

for name, port, login_path, user, pw, data_path in apps:
    # login
    cmd = f"curl -s -m 10 -c /tmp/{name}.cookie -X POST 'http://localhost:{port}{login_path}' -H 'Content-Type: application/json' -d '{{\"username\":\"{user}\",\"password\":\"{pw}\"}}' -o /dev/null -w 'login=%{{http_code}} '"
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    login_out = stdout.read().decode().strip()
    # data
    cmd2 = f"curl -s -m 10 -b /tmp/{name}.cookie 'http://localhost:{port}{data_path}' | head -c 400"
    stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=30)
    data_out = stdout.read().decode().strip()
    print(f'=== {name} ===')
    print(login_out)
    print(data_out[:400])
    print()

ssh.close()
