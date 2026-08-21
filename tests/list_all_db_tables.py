import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

for db in ['ykp_erp', 'ykp_master', 'ykp_hr', 'ykp_finance', 'ykp_hermez']:
    cmd = f"docker exec ykp-postgres psql -U ykp -d {db} -c '\\dt' 2>&1 | head -30"
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    print(f"=== {db} ===")
    print(stdout.read().decode())
    print()

ssh.close()
