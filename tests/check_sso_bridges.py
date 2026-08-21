import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# SSO bridge checks (GET, follow redirect, capture final status + cookie)
checks = [
    ("finance", "http://localhost:3003/api/auth/login?role=OWNER&token=ykp_sso_secret_2024_prod_v1&redirect=/"),
    ("hermez",  "http://localhost:3004/api/auth/login?role=SUPER_ADMIN&token=ykp_sso_secret_2024_prod_v1&redirect=/"),
    ("owner",   "http://localhost:3010/api/auth/login?role=SUPER_ADMIN&token=ykp_sso_secret_2024_prod_v1&redirect=/"),
    ("ops",     "http://localhost:3007/api/auth/login?role=OWNER&token=ykp_sso_secret_2024_prod_v1&redirect=/"),
]

for name, url in checks:
    cmd = f"curl -s -m 15 -o /dev/null -w '%{{http_code}} %{{redirect_url}}' -L '{url}'"
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    print(f"{name}: {stdout.read().decode().strip()}")

ssh.close()
