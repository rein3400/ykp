import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cmd = "curl -s -m 15 http://localhost:3007/ops/telegram"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
html = stdout.read().decode()
err = stderr.read().decode()
ssh.close()

print('=== bot username markers in HTML ===')
for marker in ['justatestermaybot', 'ykp_hermez_bot', 't.me/']:
    print(f'{marker}: {"FOUND" if marker in html else "not found"}')

# extract t.me links
import re
links = re.findall(r't\.me/[a-zA-Z0-9_]+', html)
print('t.me links:', sorted(set(links)) if links else 'none (page requires login, no deep link rendered)')

if err:
    print('STDERR:', err)
