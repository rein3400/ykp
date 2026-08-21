import paramiko

HOST = '187.77.114.168'
USER = 'dev'
PWD = 'password'

CANONICAL = """    'user_id',
    'username',
    'password_hash',
    'role',
    'brand_id',
    'outlet_id',
    'department',
    'employee_id',
    'telegram_id',
    'active_status',
    'must_change_password',
    'created_at',
    'last_login_at'
  ],"""

def sftp_edit(remote_path, old, new):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PWD)
    sftp = ssh.open_sftp()
    with sftp.open(remote_path, 'r') as f:
        content = f.read().decode('utf-8')
    if old not in content:
        print(f'ERROR: old string not found in {remote_path}')
        sftp.close(); ssh.close()
        return False
    content = content.replace(old, new, 1)
    with sftp.open(remote_path, 'w') as f:
        f.write(content)
    sftp.close(); ssh.close()
    print(f'EDITED {remote_path}')
    return True

# HR: replace 14-col header (with duplicate employee_id) with 13-col canonical
hr_path = '/home/dev/ykp/ykp-hr-v1/src/db/sheets.ts'
hr_old = """  [TABS.users]: [
    'user_id',
    'username',
    'password_hash',
    'role',
    'brand_id',
    'outlet_id',
    'department',
    'employee_id',
    'telegram_id',
    'active_status',
    'must_change_password',
    'created_at',
    'last_login_at',
    'employee_id'
  ],"""
hr_new = "  [TABS.users]: [\n" + CANONICAL
sftp_edit(hr_path, hr_old, hr_new)

# Finance: replace 10-col header with 13-col canonical
fin_path = '/home/dev/ykp/ykp-finance-v1/src/db/sheets.ts'
fin_old = """  [TABS.users]: [
    'user_id', 'username', 'password_hash', 'role', 'brand_id', 'outlet_id',
    'active_status', 'created_at', 'last_login_at', 'employee_id'
  ],"""
fin_new = "  [TABS.users]: [\n" + CANONICAL
sftp_edit(fin_path, fin_old, fin_new)

print('DONE')
