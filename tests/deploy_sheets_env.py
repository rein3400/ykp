import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# 1. Read HR-v1 .env to extract proven Google credentials
stdin, stdout, stderr = ssh.exec_command("cat /home/dev/ykp/ykp-hr-v1/.env", timeout=30)
hr_env = stdout.read().decode()

def get_val(key):
    for line in hr_env.splitlines():
        if line.startswith(key + '='):
            return line.split('=', 1)[1]
    return None

email = get_val('GOOGLE_SERVICE_ACCOUNT_EMAIL')
privkey = get_val('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')  # raw, includes quotes + \n literals
sheet_id = get_val('YKP_HR_SPREADSHEET_ID')

print('email:', email)
print('sheet_id:', sheet_id)
print('privkey starts:', privkey[:40] if privkey else None)

if not (email and privkey and sheet_id):
    print('ERROR: missing creds from HR-v1 env')
    ssh.close()
    raise SystemExit(1)

# 2. Build new .env for each app
SPREADSHEET = sheet_id
BOT_TOKEN = '8946402437:AAHymZA4JXNSnDkmbmxoKbrq9kbn9mfg8-8'

envs = {
    'ykp-finance-v1': f"""USE_MOCK_DB=false
DEFAULT_TZ=Asia/Jakarta
ENVIRONMENT=TESTING
SESSION_SECRET=611afbf55d6909a21a913ce4dc9f4ee888e8fe4aa74824ab71cbfe020dac7328
CRON_SECRET=933970dd544e1530bce1da49d540b88d132d15ef45ec8bbb764230ca550375b2
GOOGLE_SERVICE_ACCOUNT_EMAIL={email}
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY={privkey}
YKP_FINANCE_SPREADSHEET_ID={SPREADSHEET}
TELEGRAM_BOT_TOKEN={BOT_TOKEN}
TELEGRAM_CHAT_ID=5721500978
PORT=3009
""",
    'ykp-ops-v1': f"""NODE_ENV=production
PORT=3007
USE_MOCK_DB=false
SESSION_SECRET=be98519d38f96fff2ca1dc176b734f82cc8d5716a1f88741e1a778382a561abc
DEFAULT_TZ=Asia/Jakarta
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=justatestermaybot
TELEGRAM_BOT_TOKEN={BOT_TOKEN}
TELEGRAM_CHAT_ID=5721500978
GOOGLE_SERVICE_ACCOUNT_EMAIL={email}
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY={privkey}
YKP_OPS_SPREADSHEET_ID={SPREADSHEET}
""",
    'ykp-warehouse-v1': f"""NODE_ENV=production
PORT=3005
USE_MOCK_DB=false
SESSION_SECRET=b3dcba1aaca48b2c3eb2295999d2d043f2570dea73e21094aea8b16806f04045
DEFAULT_TZ=Asia/Jakarta
YKP_HUB_ORIGIN=https://oseedigital.tech
GOOGLE_SERVICE_ACCOUNT_EMAIL={email}
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY={privkey}
YKP_WAREHOUSE_SPREADSHEET_ID={SPREADSHEET}
TELEGRAM_BOT_TOKEN={BOT_TOKEN}
TELEGRAM_CHAT_ID=-5437367893
ENVIRONMENT=TESTING
""",
    'ykp-investor-v1': f"""NODE_ENV=production
PORT=3006
USE_MOCK_DB=false
SESSION_SECRET=24c675c7d0a6b303aae8f52d36201dae0c0b6f515dce8f315c6e13c4dd2f6ec3
DEFAULT_TZ=Asia/Jakarta
GOOGLE_SERVICE_ACCOUNT_EMAIL={email}
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY={privkey}
YKP_INVESTOR_SPREADSHEET_ID={SPREADSHEET}
YKP_FINANCE_SPREADSHEET_ID={SPREADSHEET}
FINANCE_URL=https://ykp-erp-finance-production.up.railway.app
ENVIRONMENT=TESTING
""",
}

sftp = ssh.open_sftp()
for app, content in envs.items():
    path = f'/home/dev/ykp/{app}/.env'
    with sftp.file(path, 'w') as f:
        f.write(content)
    print(f'wrote {path}')
sftp.close()

ssh.close()
print('DONE writing env files')
