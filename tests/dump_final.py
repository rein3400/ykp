import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== OPS TAB_HEADERS telegramDeliveryLog block (145-160) ==="
sed -n '145,160p' /home/dev/ykp/ykp-ops-v1/src/db/sheets.ts
echo ""
echo "=== OPS appendRows signature (200-225) ==="
sed -n '200,225p' /home/dev/ykp/ykp-ops-v1/src/db/sheets.ts
echo ""
echo "=== HR link route ==="
cat /home/dev/ykp/ykp-hr-v1/src/app/api/hr/telegram/link/route.ts
echo ""
echo "=== HR telegram.ts consumeLinkCode full (190-235) ==="
sed -n '190,235p' /home/dev/ykp/ykp-hr-v1/src/lib/telegram.ts
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
