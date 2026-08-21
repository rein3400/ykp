import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('187.77.114.168', username='dev', password='password', timeout=30)

# login as OWNER, then probe endpoints
cmd = (
    'curl -s -c /tmp/ck.txt -X POST http://localhost:3003/api/auth/login '
    '-H "Content-Type: application/json" -d \'{"role":"OWNER"}\' -o /dev/null; '
    'for ep in '
    '"/api/fin/expense" '
    '"/api/fin/supplier" '
    '"/api/fin/petty-cash" '
    '"/api/fin/unpaid" '
    '"/api/fin/summary" '
    '"/api/fin/closing-cash" '
    '"/api/fin/pos" '
    '"/api/fin/analytics/revenue" '
    '"/api/fin/analytics/profit"; '
    'do '
    '  code=$(curl -s -b /tmp/ck.txt -o /dev/null -w "%{http_code}" --max-time 15 "http://localhost:3003$ep"); '
    '  echo "$ep -> $code"; '
    'done'
)

stdin, stdout, stderr = c.exec_command(cmd, timeout=120)
print(stdout.read().decode())
print(stderr.read().decode())
c.close()
