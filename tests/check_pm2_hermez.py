import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin
echo "=== pm2 list ==="
pm2 list 2>&1 | head -40
echo ""
echo "=== hermez config.ts (modules + botToken) ==="
grep -n "modules\|botToken\|botSecret\|hr:" /home/dev/ykp/ykp-hermez/src/config.ts 2>/dev/null | head -30
echo ""
echo "=== hermez .env (full, masked) ==="
sed -E 's/(TOKEN|SECRET|KEY)=.*/\1=***MASKED***/' /home/dev/ykp/ykp-hermez/.env 2>/dev/null | head -40
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
