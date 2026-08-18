import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

sftp = ssh.open_sftp()
route_path = '/home/dev/ykp/ykp-hr-v1/src/app/api/hr/attendance/telegram/route.ts'
with sftp.file(route_path, 'r') as f:
    route = f.read().decode()

old = """  if (intent === 'clock-in') {
    const loc = msg.location;
    const result = await performClockIn({"""
new = """  if (intent === 'clock-in') {
    const loc = msg.location;
    if (!loc || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) {
      await reply('📍 Kirim lokasi kamu untuk absen masuk. Tekan tombol "Kirim Lokasi" di bawah.', locationReplyMarkup());
      return ok({ ok: true, needs_location: true });
    }
    const result = await performClockIn({"""

if old in route:
    route = route.replace(old, new)
    print('[route] clock-in now requires location')
else:
    print('[route] WARNING: pattern not found')

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
