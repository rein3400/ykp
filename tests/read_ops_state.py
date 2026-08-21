import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== OPS lib/telegram.ts: createLinkCode/consumeLinkCode ==="
grep -n "createLinkCode\|consumeLinkCode\|pendingCodes\|CODE_TTL" /home/dev/ykp/ykp-ops-v1/src/lib/telegram.ts
echo ""
echo "=== OPS sheets.ts TABS ==="
sed -n '40,70p' /home/dev/ykp/ykp-ops-v1/src/db/sheets.ts
echo ""
echo "=== OPS sidebar.tsx (full) ==="
cat /home/dev/ykp/ykp-ops-v1/src/components/sidebar.tsx
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
