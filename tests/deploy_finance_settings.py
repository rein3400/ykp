import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

sftp = ssh.open_sftp()

base = '/home/dev/ykp/ykp-finance-v1'
files = [
    ('src/db/sheets.ts', 'ykp-finance-v1/src/db/sheets.ts'),
    ('src/lib/settings.ts', 'ykp-finance-v1/src/lib/settings.ts'),
    ('src/lib/telegram.ts', 'ykp-finance-v1/src/lib/telegram.ts'),
    ('src/app/api/finance/settings/route.ts', 'ykp-finance-v1/src/app/api/finance/settings/route.ts'),
    ('src/app/finance/settings/page.tsx', 'ykp-finance-v1/src/app/finance/settings/page.tsx'),
    ('src/app/finance/settings/settings-client.tsx', 'ykp-finance-v1/src/app/finance/settings/settings-client.tsx'),
]

for remote_rel, local_rel in files:
    remote = f'{base}/{remote_rel}'
    local = local_rel
    # ensure remote dir exists
    import os
    remote_dir = os.path.dirname(remote)
    ssh.exec_command(f'mkdir -p {remote_dir}')[1].read()
    sftp.put(local, remote)
    print(f'UPLOADED {local} -> {remote}')

sftp.close()

# build
cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-finance-v1 && npm run build 2>&1 | tail -20"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=600)
print('=== build ===')
print(stdout.read().decode())
print(stderr.read().decode())

# restart
cmd2 = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; pm2 restart ykp-finance-v1 --update-env 2>&1 | tail -5"
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=60)
print('=== restart ===')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
