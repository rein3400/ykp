import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

cmd = r'''
echo "########## HR telegram-link-client.tsx ##########"
cat /home/dev/ykp/ykp-hr-v1/src/features/hr/components/telegram-link-client.tsx
echo ""
echo "########## HR page.tsx ##########"
cat /home/dev/ykp/ykp-hr-v1/src/app/hr/telegram/page.tsx
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
