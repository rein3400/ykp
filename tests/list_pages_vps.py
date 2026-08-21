import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

script = r'''
for d in ykp-hr-v1 ykp-finance-v1 ykp-warehouse-v1 ykp-investor-v1 ykp-ops-v1 ykp-owner-v1; do
  echo "== $d =="
  find /home/dev/ykp/$d/src/app -name page.tsx 2>/dev/null | sort
done
'''

stdin, stdout, stderr = ssh.exec_command(script)
print('STDOUT:\n' + stdout.read().decode())
print('STDERR:\n' + stderr.read().decode())
ssh.close()
