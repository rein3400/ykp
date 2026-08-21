import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# Hit data endpoints on each app to confirm they read from Sheets
checks = [
    ('finance-v1', 3009, '/api/finance/summary'),
    ('ops', 3007, '/api/ops/summary'),
    ('warehouse', 3005, '/api/warehouse/summary'),
    ('investor', 3006, '/api/investor/summary'),
]
for name, port, path in checks:
    cmd = f"curl -s -m 10 -o /dev/null -w '{name} {path} -> %{{http_code}}\\n' http://localhost:{port}{path}"
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    print(stdout.read().decode().strip())

# Also check a known data endpoint that returns row counts
cmd2 = "curl -s -m 10 'http://localhost:3005/api/warehouse/items' | head -c 300; echo; curl -s -m 10 'http://localhost:3009/api/finance/summary' | head -c 300"
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=30)
print('--- sample data ---')
print(stdout.read().decode())

ssh.close()
