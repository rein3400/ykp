import paramiko

HOST = '187.77.114.168'
USER = 'dev'
PASSWORD = 'password'

def patch_middleware():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD)
    sftp = ssh.open_sftp()
    path = '/home/dev/ykp/ykp-hr-v1/middleware.ts'
    with sftp.open(path, 'r') as f:
        content = f.read().decode('utf-8')

    anchor = "  // Owner activity feed: audit trail read endpoint (GET only)\n  if (pathname.startsWith('/api/hr/audit') && req.method === 'GET') {\n    return NextResponse.next();\n  }\n"
    addition = "  // Hermez AI chat bot: resolve Telegram chat id -> RBAC actor (GET only)\n  if (pathname.startsWith('/api/hr/telegram-actor') && req.method === 'GET') {\n    return NextResponse.next();\n  }\n"
    if 'telegram-actor' in content:
        print('ALREADY PATCHED')
    else:
        content = content.replace(anchor, anchor + addition)
        with sftp.open(path, 'w') as f:
            f.write(content)
        print('PATCHED middleware.ts')

    sftp.close()
    ssh.close()

if __name__ == '__main__':
    patch_middleware()
