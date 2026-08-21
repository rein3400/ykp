import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

apps = {
    'ykp-finance-v1': '/home/dev/ykp/ykp-finance-v1/src/db/sheets.ts',
    'ykp-ops-v1': '/home/dev/ykp/ykp-ops-v1/src/db/sheets.ts',
    'ykp-warehouse-v1': '/home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts',
    'ykp-investor-v1': '/home/dev/ykp/ykp-investor-v1/src/db/sheets.ts',
    'ykp-hr-v1': '/home/dev/ykp/ykp-hr-v1/src/db/sheets.ts',
}
for app, path in apps.items():
    cmd = f"grep -n \"users:\" -A 3 {path} 2>/dev/null | head -8"
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    print(f'=== {app} ===')
    print(stdout.read().decode())

ssh.close()
