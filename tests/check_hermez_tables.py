import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

script = r'''
docker exec ykp-postgres psql -U ykp -d ykp_erp -c "SELECT table_name FROM information_schema.tables WHERE table_schema='hermez' ORDER BY table_name;"
echo '---COUNT---'
docker exec ykp-postgres psql -U ykp -d ykp_erp -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='hermez';"
'''

stdin, stdout, stderr = ssh.exec_command(script)
print('STDOUT:\n' + stdout.read().decode())
print('STDERR:\n' + stderr.read().decode())
ssh.close()
