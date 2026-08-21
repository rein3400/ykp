import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# List schemas and tables in ykp_erp (schema-per-domain)
cmd = "docker exec ykp-postgres psql -U ykp -d ykp_erp -c '\\dn' 2>&1; echo '---tables all schemas---'; docker exec ykp-postgres psql -U ykp -d ykp_erp -c \"select schemaname, tablename from pg_tables where schemaname not in ('pg_catalog','information_schema') order by schemaname, tablename\" 2>&1 | head -60"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
