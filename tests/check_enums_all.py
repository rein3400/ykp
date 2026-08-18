import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cmd = """echo password | sudo -S docker exec ykp-postgres psql -U ykp -d ykp_erp -c "SELECT typname, enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname LIKE '%hermez%' OR typname LIKE '%expense%' OR typname LIKE '%finance%' ORDER BY typname;" """
stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode())
print(stderr.read().decode())
ssh.close()
