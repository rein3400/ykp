import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== HR attendance webhook: /link handling? ==="
grep -n "link\|/start\|consumeLinkCode\|parseAbsenIntent" /home/dev/ykp/ykp-hr-v1/src/app/api/hr/attendance/telegram/route.ts
echo ""
echo "=== HR telegram.ts: createLinkCode signature ==="
grep -n "export async function createLinkCode\|export function createLinkCode\|export async function consumeLinkCode" /home/dev/ykp/ykp-hr-v1/src/lib/telegram.ts
echo ""
echo "=== finance telegram.ts: createLinkCode signature ==="
grep -n "export async function createLinkCode\|export function createLinkCode\|export async function consumeLinkCode" /home/dev/ykp/ykp-finance-v1/src/lib/telegram.ts
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
