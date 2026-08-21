import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== finance consume route ==="
cat /home/dev/ykp/ykp-finance-v1/src/app/api/finance/telegram/link/consume/route.ts
echo ""
echo "=== finance link route ==="
cat /home/dev/ykp/ykp-finance-v1/src/app/api/finance/telegram/link/route.ts
'''

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=30)
stdin, stdout, stderr = c.exec_command(cmd, timeout=60)
out = stdout.read().decode()
err = stderr.read().decode()
print("STDOUT:\n" + out)
if err.strip():
    print("STDERR:\n" + err)
c.close()
