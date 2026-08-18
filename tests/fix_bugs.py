import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

sftp = ssh.open_sftp()

# --- Fix 1: route.ts clock-out filter by today ---
route_path = '/home/dev/ykp/ykp-hr-v1/src/app/api/hr/attendance/telegram/route.ts'
with sftp.file(route_path, 'r') as f:
    route = f.read().decode()

old_import = "import { safeEqual } from '@/lib/cron';"
new_import = "import { safeEqual } from '@/lib/cron';\nimport { todayWib } from '@/lib/format';"
if old_import in route and "todayWib" not in route:
    route = route.replace(old_import, new_import)
    print('[route] added todayWib import')

old_find = "rows.find((a) => a.employee_id === employee.employee_id && a.actual_check_in && !a.actual_check_out)"
new_find = "rows.find((a) => a.employee_id === employee.employee_id && a.date === todayWib() && a.actual_check_in && !a.actual_check_out)"
if old_find in route:
    route = route.replace(old_find, new_find)
    print('[route] clock-out now filters by today')
else:
    print('[route] WARNING: find pattern not found')

with sftp.file(route_path, 'w') as f:
    f.write(route)

# --- Fix 2: sheets.ts appendRows RAW ---
sheets_path = '/home/dev/ykp/ykp-hr-v1/src/db/sheets.ts'
with sftp.file(sheets_path, 'r') as f:
    sheets = f.read().decode()

old_append = "valueInputOption: 'USER_ENTERED',\n    insertDataOption: 'INSERT_ROWS',"
new_append = "valueInputOption: 'RAW',\n    insertDataOption: 'INSERT_ROWS',"
if old_append in sheets:
    sheets = sheets.replace(old_append, new_append)
    print('[sheets] appendRows -> RAW')
else:
    print('[sheets] WARNING: append pattern not found')

with sftp.file(sheets_path, 'w') as f:
    f.write(sheets)

sftp.close()

# --- Rebuild + restart ---
cmd = r"""
export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd /home/dev/ykp/ykp-hr-v1
echo '=== BUILD ==='
npm run build 2>&1 | tail -20
echo '=== RESTART ==='
pm2 restart ykp-hr-v1 --update-env 2>&1
sleep 5
pm2 list 2>&1 | grep ykp-hr-v1
"""
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
print('BUILD/RESTART:\n' + stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:\n' + err)

ssh.close()
