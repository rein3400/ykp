import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

ecosystem = """module.exports = {
  apps: [
    {
      name: 'ykp-hub',
      cwd: '/home/dev/ykp/ykp-hub',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        PATH: '/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      }
    },
    {
      name: 'ykp-hr',
      cwd: '/home/dev/ykp/ykp-erp/apps/hr',
      script: '../../node_modules/next/dist/bin/next',
      args: 'start -p 3002 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        PATH: '/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      }
    },
    {
      name: 'ykp-finance',
      cwd: '/home/dev/ykp/ykp-erp/apps/finance',
      script: '../../node_modules/next/dist/bin/next',
      args: 'start -p 3003 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        PATH: '/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      }
    },
    {
      name: 'ykp-hermez',
      cwd: '/home/dev/ykp/ykp-erp/apps/hermez',
      script: '../../node_modules/next/dist/bin/next',
      args: 'start -p 3004 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: 3004,
        PATH: '/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      }
    },
    {
      name: 'ykp-warehouse',
      cwd: '/home/dev/ykp/ykp-warehouse-v1',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3005 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        PATH: '/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      }
    },
    {
      name: 'ykp-investor',
      cwd: '/home/dev/ykp/ykp-investor-v1',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3006 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
        PATH: '/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      }
    },
    {
      name: 'ykp-ops',
      cwd: '/home/dev/ykp/ykp-ops-v1',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3007 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: 3007,
        PATH: '/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      }
    },
    {
      name: 'ykp-hr-v1',
      cwd: '/home/dev/ykp/ykp-hr-v1',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3008 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: 3008,
        PATH: '/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      }
    },
    {
      name: 'ykp-finance-v1',
      cwd: '/home/dev/ykp/ykp-finance-v1',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3009 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: 3009,
        PATH: '/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      }
    },
    {
      name: 'ykp-owner-v1',
      cwd: '/home/dev/ykp/ykp-owner-v1',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3010 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
        PATH: '/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      }
    }
  ]
};
"""

sftp = ssh.open_sftp()
with sftp.file('/home/dev/ykp/ecosystem.config.js', 'w') as f:
    f.write(ecosystem)
sftp.close()

setup_cmd = """export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
pm2 start /home/dev/ykp/ecosystem.config.js
pm2 save
"""
stdin, stdout, stderr = ssh.exec_command(setup_cmd)
print("PM2 START STDOUT:\n", stdout.read().decode())
print("PM2 START STDERR:\n", stderr.read().decode())

ssh.close()
