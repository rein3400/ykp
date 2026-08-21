import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "########## WAREHOUSE sheets.ts TABS (40-95) ##########"
sed -n '40,95p' /home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts
echo ""
echo "########## WAREHOUSE sheets.ts TAB_HEADERS tail (285-310) ##########"
sed -n '285,310p' /home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts
echo ""
echo "########## INVESTOR sheets.ts TABS (40-60) ##########"
sed -n '40,60p' /home/dev/ykp/ykp-investor-v1/src/db/sheets.ts
echo ""
echo "########## INVESTOR sheets.ts TAB_HEADERS tail (90-110) ##########"
sed -n '90,110p' /home/dev/ykp/ykp-investor-v1/src/db/sheets.ts
echo ""
echo "########## OPS sheets.ts TABS (40-60) ##########"
sed -n '40,60p' /home/dev/ykp/ykp-ops-v1/src/db/sheets.ts
echo ""
echo "########## OPS sheets.ts TAB_HEADERS tail (find telegramDeliveryLog) ##########"
grep -n "telegramDeliveryLog\|hermezAlerts\|auditLog" /home/dev/ykp/ykp-ops-v1/src/db/sheets.ts
echo ""
echo "########## OPS findRow return shape ##########"
grep -n "rowNumber\|rowIndex" /home/dev/ykp/ykp-ops-v1/src/db/sheets.ts | head -20
echo ""
echo "########## OPS link route (restored) ##########"
cat /home/dev/ykp/ykp-ops-v1/src/app/api/ops/telegram/link/route.ts
echo ""
echo "########## OPS consume route (restored) ##########"
cat /home/dev/ykp/ykp-ops-v1/src/app/api/ops/telegram/link/consume/route.ts
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
