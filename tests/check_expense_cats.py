import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cmd = """echo password | sudo -S docker exec ykp-postgres psql -U ykp -d ykp_erp -c "SELECT * FROM master.fin_expense_category; SELECT * FROM master.fin_payment_method;" """
stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode())
print(stderr.read().decode())
ssh.close()
