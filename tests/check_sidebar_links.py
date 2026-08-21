import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
for d in ykp-finance-v1 ykp-warehouse-v1 ykp-investor-v1; do
  echo "=== $d sidebar telegram link ==="
  grep -n "telegram" /home/dev/ykp/$d/src/components/sidebar.tsx 2>/dev/null || echo "(no telegram in sidebar.tsx)"
  echo "--- sidebar files ---"
  ls /home/dev/ykp/$d/src/components/ | grep -i side
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
