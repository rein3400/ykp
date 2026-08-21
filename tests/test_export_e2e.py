import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('187.77.114.168', username='dev', password='password', timeout=30)

cmd = (
    'curl -s -c /tmp/ck.txt -X POST http://localhost:3003/api/auth/login '
    '-H "Content-Type: application/json" -d \'{"role":"OWNER"}\' '
    '-o /dev/null; '
    'echo "--- export csv (summary, Aug) ---"; '
    'curl -s -b /tmp/ck.txt -o /tmp/exp.csv '
    '-w "EXPORT_HTTP=%{http_code} SIZE=%{size_download}\\n" '
    '--max-time 20 '
    '"http://localhost:3003/api/fin/export/csv?report=summary&date_from=2026-08-01&date_to=2026-08-31"; '
    'echo "--- first 3 lines ---"; head -c 600 /tmp/exp.csv'
)

stdin, stdout, stderr = c.exec_command(cmd, timeout=60)
print(stdout.read().decode())
print(stderr.read().decode())
c.close()
