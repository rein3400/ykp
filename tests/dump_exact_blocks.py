import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
for d in ykp-finance-v1 ykp-warehouse-v1 ykp-investor-v1 ykp-ops-v1; do
  echo "########## $d ##########"
  echo "--- findRow return key ---"
  grep -n "rowNumber\|rowIndex" /home/dev/ykp/$d/src/db/sheets.ts | grep -i "return\|Promise<" | head -5
  echo "--- appendRows signature ---"
  grep -n "export async function appendRows\|export function appendRows" /home/dev/ykp/$d/src/db/sheets.ts
  echo "--- updateRow signature ---"
  grep -n "export async function updateRow\|export function updateRow" /home/dev/ykp/$d/src/db/sheets.ts
  echo "--- nowTimestampWib import in telegram.ts ---"
  grep -n "nowTimestampWib" /home/dev/ykp/$d/src/lib/telegram.ts | head -3
  echo "--- createLinkCode full block ---"
  awk '/Telegram identity linking/{f=1} f{print} /return entry.userId;/{if(f)exit}' /home/dev/ykp/$d/src/lib/telegram.ts
  echo ""
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
