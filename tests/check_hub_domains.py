import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASSWORD = "password"

cmd = r"""
for d in hr-v1 finance-v1 warehouse investor ops owner hr finance hermez; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 https://$d.oseedigital.tech/login)
  echo "$d: $code"
done
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
stdin, stdout, stderr = c.exec_command(cmd)
print(stdout.read().decode())
print(stderr.read().decode())
c.close()
