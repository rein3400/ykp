import paramiko
import time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# Wait for rate limit window to clear
time.sleep(65)

# Fresh login attempt with full response
cmd = "curl -s -m 10 -X POST 'http://localhost:3009/api/auth/login' -H 'Content-Type: application/json' -d '{\"username\":\"owner\",\"password\":\"owner123\"}'"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
print('login response:', stdout.read().decode())

ssh.close()
