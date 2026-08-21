import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

for tab in ['outlets', 'brands', 'suppliers']:
    cmd = f"grep -n 'TABS.{tab}' -A 6 /home/dev/ykp/ykp-hr-v1/src/db/sheets.ts | head -10"
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    print(f'=== HR-v1 {tab} ===')
    print(stdout.read().decode())

ssh.close()
