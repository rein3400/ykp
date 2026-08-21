import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

script = r'''
for db in ykp_master ykp_hr ykp_finance ykp_hermez; do
  echo "== $db =="
  docker exec ykp-postgres psql -U ykp -d $db -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
done
'''

stdin, stdout, stderr = ssh.exec_command(script)
print('STDOUT:\n' + stdout.read().decode())
print('STDERR:\n' + stderr.read().decode())
ssh.close()
