import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== HR findRow (505-545) ==="
sed -n '505,545p' /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
echo ""
echo "=== HR appendRows signature ==="
grep -n "export async function appendRows\|export function appendRows" /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
echo ""
echo "=== HR updateRow signature ==="
grep -n "export async function updateRow\|export function updateRow" /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
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
