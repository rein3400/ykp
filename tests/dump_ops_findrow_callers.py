import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== OPS findRow full body (240-260) ==="
sed -n '240,260p' /home/dev/ykp/ykp-ops-v1/src/db/sheets.ts
echo ""
echo "=== OPS updateRow full body (224-245) ==="
sed -n '224,245p' /home/dev/ykp/ykp-ops-v1/src/db/sheets.ts
echo ""
echo "=== createLinkCode callers (all apps) ==="
for d in ykp-hr-v1 ykp-finance-v1 ykp-warehouse-v1 ykp-investor-v1 ykp-ops-v1; do
  echo "--- $d ---"
  grep -rn "createLinkCode" /home/dev/ykp/$d/src --include=*.ts --include=*.tsx 2>/dev/null
done
echo ""
echo "=== HR telegram.ts: does it import appendRows? (already known yes) ==="
grep -n "import.*appendRows\|import.*findRow\|import.*updateRow\|import.*TABS" /home/dev/ykp/ykp-hr-v1/src/lib/telegram.ts
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
