import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cmd = """echo password | sudo -S docker exec ykp-postgres psql -U ykp -d ykp_erp -c "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog') ORDER BY table_schema, table_name;" """

stdin, stdout, stderr = ssh.exec_command(cmd)
print("TABLES:\n", stdout.read().decode())
print("STDERR:\n", stderr.read().decode())

ssh.close()
