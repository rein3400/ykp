import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

sftp = ssh.open_sftp()
route_path = '/home/dev/ykp/ykp-hr-v1/src/app/api/hr/attendance/telegram/route.ts'
with sftp.file(route_path, 'r') as f:
    route = f.read().decode()

# Fix: treat a location-only message as clock-in continuation.
# When the user shares a location, Telegram sends a message with `location`
# but no `text`. parseAbsenIntent(undefined) returns 'unknown', so it fell
# through to "Perintah tidak dikenali". Detect location messages explicitly.
old = "  const intent = parseAbsenIntent(msg.text);"
new = "  const intent = msg.location ? 'clock-in' : parseAbsenIntent(msg.text);"

if old in route:
    route = route.replace(old, new)
    print('[route] location-only message now treated as clock-in')
else:
    print('[route] WARNING: intent pattern not found')

with sftp.file(route_path, 'w') as f:
    f.write(route)
sftp.close()

cmd = r"""
export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd /home/dev/ykp/ykp-hr-v1
npm run build 2>&1 | tail -5
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
