import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# Health check all app ports
cmd = "for p in 3000 3002 3003 3004 3005 3006 3007 3008 3009 3010; do code=$(curl -s -m 8 -o /dev/null -w '%{http_code}' http://localhost:$p/ 2>/dev/null); echo \"port $p -> $code\"; done"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=120)
print('=== port health ===')
print(stdout.read().decode())
print(stderr.read().decode())

# List Postgres databases
cmd2 = "docker exec ykp-postgres psql -U postgres -c '\\l' 2>&1 | head -20"
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=30)
print('=== postgres dbs ===')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
