import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
for d in ykp-finance-v1 ykp-warehouse-v1 ykp-investor-v1; do
  echo "=== $d telegram.ts (createLinkCode body) ==="
  sed -n '160,200p' /home/dev/ykp/$d/src/lib/telegram.ts
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
