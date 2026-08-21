import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "=== OPS git status ==="
cd /home/dev/ykp/ykp-ops-v1 && git status --short 2>&1 | head -30
echo "--- git log recent ---"
cd /home/dev/ykp/ykp-ops-v1 && git log --oneline -5 2>&1
echo ""
echo "=== OPS deleted files in git? ==="
cd /home/dev/ykp/ykp-ops-v1 && git log --diff-filter=D --name-only --oneline -10 2>&1 | head -40
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
