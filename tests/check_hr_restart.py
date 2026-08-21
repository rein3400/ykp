import paramiko

HOST = "187.77.114.168"
USER = "dev"
PWD = "password"

cmd = (
    "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin; "
    "pm2 jlist | python3 -c \"import json,sys; d=json.load(sys.stdin); "
    "[print(p['name'], p['pm2_env']['status'], p['pm2_env']['restart_time'], p['pm2_env']['unstable_restarts']) for p in d if 'hr' in p['name']]\""
)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PWD, timeout=30)
stdin, stdout, stderr = c.exec_command(cmd, timeout=60)
out = stdout.read().decode()
err = stderr.read().decode()
print("STDOUT:", out)
print("STDERR:", err)
c.close()
