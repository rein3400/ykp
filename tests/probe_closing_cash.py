import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('187.77.114.168', username='dev', password='password', timeout=30)

cmd = (
    'curl -s -c /tmp/ck.txt -X POST http://localhost:3003/api/auth/login '
    '-H "Content-Type: application/json" -d \'{"role":"OWNER"}\' -o /dev/null; '
    'echo "--- closing-cash (date+outlet) ---"; '
    'curl -s -b /tmp/ck.txt -o /dev/null -w "%{http_code}\\n" --max-time 15 '
    '"http://localhost:3003/api/fin/closing-cash?date=2026-08-16&outlet_id=OL-001"; '
    'echo "--- hermez endpoints ---"; '
    'for ep in "/api/hermez/run" "/api/hermez/warehouse-summary" "/api/hermez/ops-summary"; do '
    '  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "http://localhost:3004$ep"); '
    '  echo "$ep -> $code"; '
    'done'
)

stdin, stdout, stderr = c.exec_command(cmd, timeout=90)
print(stdout.read().decode())
print(stderr.read().decode())
c.close()
