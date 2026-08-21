import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cmd = "docker exec ykp-postgres psql -U ykp -d ykp_hermez -c \"select key, label, is_active from hermez_config order by key\" 2>&1 | head -40"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
