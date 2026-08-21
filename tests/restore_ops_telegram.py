import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
cd /home/dev/ykp/ykp-ops-v1
echo "=== restore deleted telegram files ==="
git checkout -- src/app/api/ops/telegram/link/consume/route.ts src/app/api/ops/telegram/link/route.ts src/app/ops/telegram/page.tsx src/components/telegram-link-client.tsx 2>&1
echo "exit: $?"
echo ""
echo "=== verify restored ==="
ls -la src/app/ops/telegram/ src/app/api/ops/telegram/link/ src/components/telegram-link-client.tsx 2>&1
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
