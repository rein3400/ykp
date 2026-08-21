import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== HR telegram.ts consumeLinkCode (verify patch) ==="
sed -n '190,240p' /home/dev/ykp/ykp-hr-v1/src/lib/telegram.ts
echo ""
echo "=== HR sheets.ts TABS tail ==="
sed -n '70,85p' /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
echo ""
echo "=== package.json scripts (all 5 apps) ==="
for d in ykp-hr-v1 ykp-finance-v1 ykp-warehouse-v1 ykp-investor-v1 ykp-ops-v1; do
  echo "--- $d ---"
  grep -A15 '"scripts"' /home/dev/ykp/$d/package.json | head -18
done
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
