import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== HR appendRows body (443-490) ==="
sed -n '443,490p' /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
echo ""
echo "=== HR updateRow body (491-505) ==="
sed -n '491,505p' /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts
echo ""
echo "=== HR nowTimestampWib ==="
grep -n "nowTimestampWib" /home/dev/ykp/ykp-hr-v1/src/lib/format.ts
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
