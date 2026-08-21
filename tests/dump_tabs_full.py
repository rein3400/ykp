import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "########## WAREHOUSE TABS full (50-110) ##########"
sed -n '50,110p' /home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts
echo ""
echo "########## INVESTOR TABS full (40-70) ##########"
sed -n '40,70p' /home/dev/ykp/ykp-investor-v1/src/db/sheets.ts
echo ""
echo "########## OPS TABS full (30-60) ##########"
sed -n '30,60p' /home/dev/ykp/ykp-ops-v1/src/db/sheets.ts
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
