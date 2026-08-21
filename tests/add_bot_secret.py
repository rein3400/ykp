import paramiko

HOST = '187.77.114.168'
USER = 'dev'
PWD = 'password'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PWD)

path = '/home/dev/ykp/ykp-hr-v1/.env'
sftp = ssh.open_sftp()
with sftp.open(path, 'r') as f:
    content = f.read().decode('utf-8')

if 'TELEGRAM_BOT_SECRET=' not in content:
    content = content.rstrip('\n') + '\nTELEGRAM_BOT_SECRET=1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52\n'

with sftp.open(path, 'w') as f:
    f.write(content)
sftp.close()

# verify
stdin, stdout, stderr = ssh.exec_command("grep -E 'TELEGRAM_BOT_SECRET|TELEGRAM_WEBHOOK_SECRET' /home/dev/ykp/ykp-hr-v1/.env")
print(stdout.read().decode())
ssh.close()
print('DONE')
