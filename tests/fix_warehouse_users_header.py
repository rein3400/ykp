import paramiko

OLD = """  [TABS.users]: [
    'user_id', 'username', 'password_hash', 'role', 'brand_id', 'outlet_id',
    'department', 'telegram_id', 'active_status', 'created_at', 'last_login_at'
  ],"""

NEW = """  [TABS.users]: [
    'user_id', 'username', 'password_hash', 'role', 'brand_id', 'outlet_id',
    'department', 'employee_id', 'telegram_id', 'active_status', 'must_change_password', 'created_at', 'last_login_at'
  ],"""

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

sftp = ssh.open_sftp()
path = '/home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts'
with sftp.open(path, 'r') as f:
    s = f.read().decode()

assert OLD in s, 'old not found'
s = s.replace(OLD, NEW)

with sftp.open(path, 'w') as f:
    f.write(s)

sftp.close()
ssh.close()
print('OK replaced')
