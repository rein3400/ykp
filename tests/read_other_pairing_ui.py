import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
for d in ykp-finance-v1 ykp-warehouse-v1 ykp-investor-v1 ykp-ops-v1; do
  echo "########## $d telegram-link-client.tsx ##########"
  cat /home/dev/ykp/$d/src/components/telegram-link-client.tsx 2>/dev/null
  echo ""
  echo "########## $d page.tsx ##########"
  find /home/dev/ykp/$d/src/app -path "*telegram/page.tsx" -exec cat {} \; 2>/dev/null
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
