import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# Search the built .next static chunks for the bot username
cmd = "grep -rl 'justatestermaybot' /home/dev/ykp/ykp-ops-v1/.next/static/ 2>/dev/null; echo '---fallback---'; grep -rl 'ykp_hermez_bot' /home/dev/ykp/ykp-ops-v1/.next/static/ 2>/dev/null"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
out = stdout.read().decode()
err = stderr.read().decode()
ssh.close()

print('=== files containing justatestermaybot ===')
print(out)
if err:
    print('STDERR:', err)
