import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
for d in ykp-finance-v1 ykp-warehouse-v1 ykp-investor-v1; do
  echo "=== $d ==="
  echo "--- all sidebar-ish files ---"
  find /home/dev/ykp/$d/src -iname "*sidebar*" -o -iname "*nav*" 2>/dev/null | head -10
  echo "--- grep telegram in src/components (all files) ---"
  grep -rln "telegram" /home/dev/ykp/$d/src/components 2>/dev/null
  echo "--- grep telegram in src/app (layout) ---"
  grep -rln "telegram" /home/dev/ykp/$d/src/app 2>/dev/null | grep -v "telegram/" | head -10
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
