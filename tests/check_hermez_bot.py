import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== hermez app: telegram/bot files ==="
find /home/dev/ykp/ykp-hermez/src -iname "*bot*" -o -iname "*telegram*" 2>/dev/null | head -30
echo ""
echo "=== hermez app: grep link/consume ==="
grep -rln "link/consume\|consumeLinkCode\|/link\|/start" /home/dev/ykp/ykp-hermez/src 2>/dev/null | head -20
echo ""
echo "=== hermez app: webhook route? ==="
find /home/dev/ykp/ykp-hermez/src/app -type d -name "*telegram*" -o -type d -name "*webhook*" 2>/dev/null
echo ""
echo "=== hermez .env telegram vars ==="
grep -E "TELEGRAM" /home/dev/ykp/ykp-hermez/.env 2>/dev/null
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
