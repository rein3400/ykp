import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

# Restore the Telegram sidebar item by reverting sidebar.tsx to HEAD
cmd = r'''
cd /home/dev/ykp/ykp-ops-v1
git checkout -- src/components/sidebar.tsx
echo "exit: $?"
grep -n "Telegram" src/components/sidebar.tsx
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
