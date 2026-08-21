import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== hermez src/link.ts ==="
cat /home/dev/ykp/ykp-hermez/src/link.ts
echo ""
echo "=== hermez src/telegram.ts (head 80) ==="
sed -n '1,80p' /home/dev/ykp/ykp-hermez/src/telegram.ts
echo ""
echo "=== hermez src/index.ts grep link/start/consume ==="
grep -n "link\|/start\|consume\|webhook" /home/dev/ykp/ykp-hermez/src/index.ts
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
