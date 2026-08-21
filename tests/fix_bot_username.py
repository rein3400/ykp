import paramiko

HOST = '187.77.114.168'
USER = 'dev'
PWD = 'password'

apps = ['ykp-hr-v1', 'ykp-finance-v1', 'ykp-ops-v1', 'ykp-warehouse-v1', 'ykp-investor-v1']

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PWD)

for app in apps:
    path = f'/home/dev/ykp/{app}/.env'
    # read
    sftp = ssh.open_sftp()
    with sftp.open(path, 'r') as f:
        content = f.read().decode('utf-8')
    lines = content.splitlines()
    found = False
    for i, line in enumerate(lines):
        if line.startswith('NEXT_PUBLIC_TELEGRAM_BOT_USERNAME='):
            lines[i] = 'NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=justatestermaybot'
            found = True
    if not found:
        lines.append('NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=justatestermaybot')
    new_content = '\n'.join(lines) + '\n'
    with sftp.open(path, 'w') as f:
        f.write(new_content)
    sftp.close()
    print(f'UPDATED {path}')

# verify
stdin, stdout, stderr = ssh.exec_command("grep -H 'NEXT_PUBLIC_TELEGRAM_BOT_USERNAME' /home/dev/ykp/ykp-hr-v1/.env /home/dev/ykp/ykp-finance-v1/.env /home/dev/ykp/ykp-ops-v1/.env /home/dev/ykp/ykp-warehouse-v1/.env /home/dev/ykp/ykp-investor-v1/.env")
print('VERIFY:\n' + stdout.read().decode())
ssh.close()
print('DONE')
