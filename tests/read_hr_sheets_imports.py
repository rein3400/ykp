import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== HR sheets.ts TABS block (60-90) ==="
sed -n '60,90p' /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
echo ""
echo "=== HR sheets.ts telegramLinkCodes header (405-420) ==="
sed -n '405,420p' /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
echo ""
echo "=== HR telegram.ts imports (1-40) ==="
sed -n '1,40p' /home/dev/ykp/ykp-hr-v1/src/lib/telegram.ts
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
