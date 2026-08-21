import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# Postgres ERP app data endpoints (via SSO cookie)
checks = [
    ("hr summary count", "curl -s -m 15 'http://localhost:3002/api/hr/summary/count' | head -c 300"),
    ("finance summary",   "curl -s -m 15 'http://localhost:3003/api/fin/summary' | head -c 300"),
    ("hermez health",     "curl -s -m 15 'http://localhost:3004/api/hermez/health' | head -c 300"),
    ("hermez root",       "curl -s -m 15 -o /dev/null -w '%{http_code}' 'http://localhost:3004/'"),
]

for name, cmd in checks:
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    print(f"=== {name} ===")
    print(stdout.read().decode().strip())
    print()

ssh.close()
