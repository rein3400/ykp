import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "########## WAREHOUSE telegram.ts createLinkCode block ##########"
sed -n '160,200p' /home/dev/ykp/ykp-warehouse-v1/src/lib/telegram.ts
echo ""
echo "########## OPS telegram.ts createLinkCode block ##########"
sed -n '160,200p' /home/dev/ykp/ykp-ops-v1/src/lib/telegram.ts
echo ""
echo "########## OPS telegram.ts imports ##########"
sed -n '1,20p' /home/dev/ykp/ykp-ops-v1/src/lib/telegram.ts
echo ""
echo "########## WAREHOUSE link route ##########"
cat /home/dev/ykp/ykp-warehouse-v1/src/app/api/warehouse/telegram/link/route.ts
echo ""
echo "########## INVESTOR link route ##########"
cat /home/dev/ykp/ykp-investor-v1/src/app/api/investor/telegram/link/route.ts
echo ""
echo "########## OPS link route (if exists) ##########"
cat /home/dev/ykp/ykp-ops-v1/src/app/api/ops/telegram/link/route.ts 2>/dev/null || echo "(NOT FOUND)"
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
