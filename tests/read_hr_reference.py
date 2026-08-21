import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== HR sheets.ts: TABS + telegram_link_codes header ==="
grep -n "telegram_link_codes\|telegramLinkCodes" /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
echo ""
echo "=== HR telegram.ts full (createLinkCode + consumeLinkCode) ==="
sed -n '170,230p' /home/dev/ykp/ykp-hr-v1/src/lib/telegram.ts
echo ""
echo "=== HR webhook: link handling block ==="
sed -n '50,75p' /home/dev/ykp/ykp-hr-v1/src/app/api/hr/attendance/telegram/route.ts
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
