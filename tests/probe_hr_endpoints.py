import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('187.77.114.168', username='dev', password='password', timeout=30)

cmd = (
    'curl -s -c /tmp/ckh.txt -X POST http://localhost:3002/api/auth/login '
    '-H "Content-Type: application/json" -d \'{"role":"OWNER"}\' -o /dev/null; '
    'for ep in '
    '"/api/hr/attendance" '
    '"/api/hr/payroll" '
    '"/api/hr/employees" '
    '"/api/hr/rules" '
    '"/api/hr/summary" '
    '"/api/hr/daily-report"; '
    'do '
    '  code=$(curl -s -b /tmp/ckh.txt -o /dev/null -w "%{http_code}" --max-time 15 "http://localhost:3002$ep"); '
    '  echo "$ep -> $code"; '
    'done'
)

stdin, stdout, stderr = c.exec_command(cmd, timeout=120)
print(stdout.read().decode())
print(stderr.read().decode())
c.close()
