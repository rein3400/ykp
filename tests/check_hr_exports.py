import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== HR sheets.ts exports ==="
grep -n "^export" /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
echo ""
echo "=== HR sheets.ts getSheetsClient ==="
grep -n "getSheetsClient\|function getSheetsClient\|const getSheetsClient" /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
echo ""
echo "=== HR sheets.ts readTab signature ==="
grep -n "export async function readTab\|export function readTab" /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
echo ""
echo "=== HR sheets.ts isMockMode ==="
grep -n "isMockMode" /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts | head -3
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
