import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== HR sheets.ts findRow signature ==="
grep -n "export async function findRow\|export function findRow" /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
echo ""
echo "=== HR sheets.ts TABS full (40-80) ==="
sed -n '40,80p' /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
echo ""
echo "=== Finance sheets.ts TABS full ==="
sed -n '40,80p' /home/dev/ykp/ykp-finance-v1/src/db/sheets.ts
echo ""
echo "=== Finance sheets.ts TAB_HEADERS tail (195-215) ==="
sed -n '195,215p' /home/dev/ykp/ykp-finance-v1/src/db/sheets.ts
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
