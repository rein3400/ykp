import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== HR users header ==="
grep -n "\[TABS.users\]" /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
sed -n "$(grep -n '\[TABS.users\]' /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts | head -1 | cut -d: -f1),+12p" /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
echo ""
echo "=== Finance users header ==="
sed -n "$(grep -n '\[TABS.users\]' /home/dev/ykp/ykp-finance-v1/src/db/sheets.ts | head -1 | cut -d: -f1),+12p" /home/dev/ykp/ykp-finance-v1/src/db/sheets.ts
echo ""
echo "=== Warehouse users header ==="
sed -n "$(grep -n '\[TABS.users\]' /home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts | head -1 | cut -d: -f1),+12p" /home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts
echo ""
echo "=== Investor investor_users header ==="
sed -n "$(grep -n '\[TABS.users\]' /home/dev/ykp/ykp-investor-v1/src/db/sheets.ts | head -1 | cut -d: -f1),+12p" /home/dev/ykp/ykp-investor-v1/src/db/sheets.ts
echo ""
echo "=== Ops ops_users header ==="
sed -n "$(grep -n '\[TABS.users\]' /home/dev/ykp/ykp-ops-v1/src/db/sheets.ts | head -1 | cut -d: -f1),+12p" /home/dev/ykp/ykp-ops-v1/src/db/sheets.ts
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
