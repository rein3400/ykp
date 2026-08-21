import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
for d in ykp-finance-v1 ykp-warehouse-v1 ykp-investor-v1 ykp-owner-v1 ykp-hermez; do
  echo "=== $d ==="
  echo "--- telegram dirs ---"
  find /home/dev/ykp/$d/src/app -type d -name telegram 2>/dev/null
  echo "--- telegram api routes ---"
  find /home/dev/ykp/$d/src/app/api -type d -name telegram 2>/dev/null
  echo "--- sidebar telegram refs ---"
  grep -rl "telegram" /home/dev/ykp/$d/src/components 2>/dev/null | head -5
  echo "--- webhook handler (attendance/telegram) ---"
  find /home/dev/ykp/$d/src/app/api -type d -path "*attendance*" 2>/dev/null
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
