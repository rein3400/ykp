import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

ports = [80, 3000, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010]
for p in ports:
    cmd = f"curl -s -o /dev/null -w '%{{http_code}}' 'http://187.77.114.168:{p}/'"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    code = stdout.read().decode().strip()
    print(f"Port {p:4} -> HTTP {code}")

ssh.close()
