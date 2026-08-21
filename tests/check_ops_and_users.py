import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== Ops app: telegram dirs/files ==="
find /home/dev/ykp/ykp-ops-v1/src -path "*telegram*" 2>/dev/null
echo "--- ops layout.tsx telegram ref ---"
grep -n "telegram" /home/dev/ykp/ykp-ops-v1/src/app/ops/layout.tsx 2>/dev/null || echo "(no layout ref)"
echo "--- ops sidebar files ---"
find /home/dev/ykp/ykp-ops-v1/src -iname "*sidebar*" -o -iname "*nav*" 2>/dev/null
echo "--- ops components list ---"
ls /home/dev/ykp/ykp-ops-v1/src/components/ 2>/dev/null
echo ""
echo "=== investor users tab name ==="
grep -n "users:" /home/dev/ykp/ykp-investor-v1/src/db/sheets.ts
echo "=== finance users tab name ==="
grep -n "users:" /home/dev/ykp/ykp-finance-v1/src/db/sheets.ts
echo "=== warehouse users tab name ==="
grep -n "users:" /home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts
echo "=== ops users tab name ==="
grep -n "users:" /home/dev/ykp/ykp-ops-v1/src/db/sheets.ts 2>/dev/null || echo "(no sheets.ts or no users)"
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
