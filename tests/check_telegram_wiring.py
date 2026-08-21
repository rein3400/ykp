import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
for d in ykp-finance-v1 ykp-warehouse-v1 ykp-investor-v1; do
  echo "=== $d ==="
  echo "--- api/finance|warehouse|investor/telegram tree ---"
  find /home/dev/ykp/$d/src/app/api -path "*telegram*" -type f 2>/dev/null
  echo "--- page tree ---"
  find /home/dev/ykp/$d/src/app -path "*telegram*" -type f 2>/dev/null | grep -v api
  echo "--- consume endpoint exists? ---"
  grep -rl "consume" /home/dev/ykp/$d/src/app/api 2>/dev/null
  echo "--- webhook secret usage ---"
  grep -rl "X-Telegram-Bot-Api-Secret-Token\|TELEGRAM_WEBHOOK_SECRET" /home/dev/ykp/$d/src 2>/dev/null | head -5
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
