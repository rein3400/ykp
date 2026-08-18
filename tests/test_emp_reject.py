import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

NODE = r"""
import { performClockIn } from './src/lib/attendance-service';
(async () => {
  const r = await performClockIn({
    employeeId: 'EMP-003',
    latitude: -6.2088,
    longitude: 106.8456,
    actor: { userId: 'U-EMP-3', role: 'supervisor', employeeId: 'EMP-003' },
    source: 'telegram'
  });
  console.log(JSON.stringify(r));
})();
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-hr-v1/test_emp_reject.ts', 'w') as f:
    f.write(NODE)
sftp.close()

cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; cd /home/dev/ykp/ykp-hr-v1 && npx tsx test_emp_reject.ts"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=120)
print(stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:', err)
ssh.close()
