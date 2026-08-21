import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASSWORD = "password"

ENV = '''NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://oseedigital.tech
NEXT_PUBLIC_ERP_SSO_SECRET=ykp_sso_secret_2024_prod_v1
NEXT_PUBLIC_YKP_HR_URL=https://hr-v1.oseedigital.tech
NEXT_PUBLIC_YKP_FINANCE_URL=https://finance-v1.oseedigital.tech
NEXT_PUBLIC_YKP_HERMEZ_URL=https://hermez.oseedigital.tech
NEXT_PUBLIC_YKP_WAREHOUSE_URL=https://warehouse.oseedigital.tech
NEXT_PUBLIC_YKP_INVESTOR_URL=https://investor.oseedigital.tech
NEXT_PUBLIC_YKP_OPS_URL=https://ops.oseedigital.tech
NEXT_PUBLIC_YKP_OWNER_URL=https://owner.oseedigital.tech
ERP_SSO_SECRET=ykp_sso_secret_2024_prod_v1
HUB_SESSION_SECRET=b12b85a1b365ddaa4bdd0080792102cf65c91f905ca51cdda6a1be0740245c23
SESSION_SECRET=b12b85a1b365ddaa4bdd0080792102cf65c91f905ca51cdda6a1be0740245c23

# Internal server-to-server URLs (for proxy routes)
YKP_HR_INTERNAL_URL=http://localhost:3008
YKP_FINANCE_INTERNAL_URL=http://localhost:3009
YKP_HERMEZ_INTERNAL_URL=http://localhost:3004
YKP_WAREHOUSE_INTERNAL_URL=http://localhost:3005
YKP_INVESTOR_INTERNAL_URL=http://localhost:3006
YKP_OPS_INTERNAL_URL=http://localhost:3007
YKP_OWNER_INTERNAL_URL=http://localhost:3010
'''

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

sftp = ssh.open_sftp()
with sftp.open('/home/dev/ykp/ykp-hub/.env', 'w') as f:
    f.write(ENV)
sftp.close()

cmd = (
    "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin; "
    "cd /home/dev/ykp/ykp-hub && npm run build 2>&1 | tail -8 && "
    "pm2 restart ykp-hub --update-env 2>&1 | tail -3"
)
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=600)
print(stdout.read().decode())
print(stderr.read().decode())
ssh.close()
