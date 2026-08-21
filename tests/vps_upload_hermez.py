import paramiko
import os

HOST = '187.77.114.168'
USER = 'dev'
PASSWORD = 'password'
REMOTE_DIR = '/home/dev/ykp/ykp-hermez'

# Local files to upload (relative to repo root), mapped to remote paths.
FILES = [
    ('ykp-hermez/src/actor.ts', 'src/actor.ts'),
    ('ykp-hermez/src/actor.test.ts', 'src/actor.test.ts'),
    ('ykp-hermez/src/brain.ts', 'src/brain.ts'),
    ('ykp-hermez/src/brief.ts', 'src/brief.ts'),
    ('ykp-hermez/src/config.ts', 'src/config.ts'),
    ('ykp-hermez/src/index.ts', 'src/index.ts'),
    ('ykp-hermez/src/llm.ts', 'src/llm.ts'),
    ('ykp-hermez/src/scope.ts', 'src/scope.ts'),
    ('ykp-hermez/src/scope.test.ts', 'src/scope.test.ts'),
    ('ykp-hermez/src/telegram.ts', 'src/telegram.ts'),
    ('ykp-hermez/src/tools.ts', 'src/tools.ts'),
    ('ykp-hermez/src/watch.ts', 'src/watch.ts'),
    ('ykp-hermez/package.json', 'package.json'),
    ('ykp-hermez/tsconfig.json', 'tsconfig.json'),
    ('ykp-hermez/README.md', 'README.md'),
    ('ykp-hermez/.env.example', '.env.example'),
]

# Files to delete on the remote (no longer part of the AI-only bot).
DELETE = ['src/link.ts', 'src/openrouter.ts']

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)
sftp = ssh.open_sftp()

for local, remote in FILES:
    local_path = os.path.join(os.path.dirname(__file__), '..', local)
    remote_path = f'{REMOTE_DIR}/{remote}'
    sftp.put(local_path, remote_path)
    print(f'UPLOADED {local} -> {remote_path}')

for remote in DELETE:
    remote_path = f'{REMOTE_DIR}/{remote}'
    try:
        sftp.remove(remote_path)
        print(f'DELETED {remote_path}')
    except FileNotFoundError:
        print(f'SKIP (not found) {remote_path}')

sftp.close()
ssh.close()
print('DONE')
