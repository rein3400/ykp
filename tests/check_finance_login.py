import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# Check finance-v1 error log
cmd = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; pm2 logs ykp-finance-v1 --lines 30 --nostream 2>/dev/null | tail -40"
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
print('=== finance-v1 logs ===')
print(stdout.read().decode())

# Verify bcrypt hash matches owner123
NODE = r"""
const bcrypt = require('/home/dev/ykp/ykp-finance-v1/node_modules/bcryptjs');
const hash = '$2b$10$jmfY5FgdmltdMVPzBviE7OIG4sZ19i7mWL/mxRJVboJ/8rNdDX6SS';
bcrypt.compare('owner123', hash).then(r => console.log('owner123 matches:', r));
bcrypt.compare('owner', hash).then(r => console.log('owner matches:', r));
"""
sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ykp-finance-v1/check_hash.js', 'w') as f:
    f.write(NODE)
sftp.close()

cmd2 = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH; cd /home/dev/ykp/ykp-finance-v1 && node check_hash.js"
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=30)
print('=== hash check ===')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
