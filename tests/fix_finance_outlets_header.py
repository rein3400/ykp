import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

path = '/home/dev/ykp/ykp-finance-v1/src/db/sheets.ts'

sftp = ssh.open_sftp()
with sftp.file(path, 'r') as f:
    content = f.read().decode()

old = """  [TABS.outlets]: [
    'outlet_id', 'brand_id', 'outlet_name', 'outlet_code', 'address',
    'status', 'created_at', 'updated_at'
  ],"""

new = """  [TABS.outlets]: [
    'outlet_id', 'brand_id', 'outlet_name', 'outlet_code', 'address',
    'latitude', 'longitude', 'attendance_radius_m', 'status', 'created_at', 'updated_at'
  ],"""

if old not in content:
    print('ERROR: outlets header block not found')
    idx = content.find('[TABS.outlets]')
    print(content[idx:idx+300])
    sftp.close()
    ssh.close()
    raise SystemExit(1)

content = content.replace(old, new)

with sftp.file(path, 'w') as f:
    f.write(content)
sftp.close()

print('OK: outlets header updated to 11 cols')

stdin, stdout, stderr = ssh.exec_command(f"grep -n 'TABS.outlets' -A 4 {path} | head -7", timeout=30)
print(stdout.read().decode())

ssh.close()
