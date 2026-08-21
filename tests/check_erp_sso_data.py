import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# Full SSO login flow then hit data endpoint with cookie
cmd = """
curl -s -m 15 -c /tmp/fin_sso.cookie -o /dev/null -w 'login=%{http_code}\\n' 'http://localhost:3003/api/auth/login?role=OWNER&token=ykp_sso_secret_2024_prod_v1&redirect=/'
curl -s -m 15 -b /tmp/fin_sso.cookie 'http://localhost:3003/api/fin/summary' | head -c 400
"""
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
print('=== finance SSO + summary ===')
print(stdout.read().decode())

cmd2 = """
curl -s -m 15 -c /tmp/hr_sso.cookie -o /dev/null -w 'login=%{http_code}\\n' 'http://localhost:3002/api/auth/login?role=OWNER&token=ykp_sso_secret_2024_prod_v1&redirect=/'
curl -s -m 15 -b /tmp/hr_sso.cookie 'http://localhost:3002/api/hr/summary/count' | head -c 400
"""
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=60)
print('=== hr SSO + summary count ===')
print(stdout.read().decode())

ssh.close()
