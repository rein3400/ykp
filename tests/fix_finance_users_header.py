import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

path = '/home/dev/ykp/ykp-finance-v1/src/db/sheets.ts'

# Read file
sftp = ssh.open_sftp()
with sftp.file(path, 'r') as f:
    content = f.read().decode()

old = """  [TABS.users]: [
    'user_id', 'username', 'password_hash', 'role', 'brand_id', 'outlet_id',
    'department', 'telegram_id', 'active_status', 'created_at', 'last_login_at'
  ],"""

new = """  [TABS.users]: [
    'user_id', 'username', 'password_hash', 'role', 'brand_id', 'outlet_id',
    'active_status', 'created_at', 'last_login_at', 'employee_id'
  ],"""

if old not in content:
    print('ERROR: old header block not found')
    # print surrounding context
    idx = content.find('[TABS.users]')
    print(content[idx:idx+300])
    sftp.close()
    ssh.close()
    raise SystemExit(1)

content = content.replace(old, new)

with sftp.file(path, 'w') as f:
    f.write(content)
sftp.close()

print('OK: users header updated in finance-v1 sheets.ts')

# Verify
stdin, stdout, stderr = ssh.exec_command(f"grep -n 'TABS.users' -A 3 {path} | head -6", timeout=30)
print(stdout.read().decode())

ssh.close()
