import paramiko

HOST = '187.77.114.168'
USER = 'dev'
PWD = 'password'
SECRET = '1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52'

apps = ['ykp-finance-v1', 'ykp-ops-v1', 'ykp-warehouse-v1', 'ykp-investor-v1']

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PWD)

for app in apps:
    path = f'/home/dev/ykp/{app}/.env'
    sftp = ssh.open_sftp()
    with sftp.open(path, 'r') as f:
        content = f.read().decode('utf-8')
    if 'TELEGRAM_BOT_SECRET=' not in content:
        content = content.rstrip('\n') + f'\nTELEGRAM_BOT_SECRET={SECRET}\n'
        with sftp.open(path, 'w') as f:
            f.write(content)
        print(f'ADDED secret to {app}')
    else:
        print(f'{app} already has secret')
    sftp.close()

ssh.close()
print('DONE')
