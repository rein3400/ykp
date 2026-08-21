import paramiko

HOST = '187.77.114.168'
USER = 'dev'
PASSWORD = 'password'

ENV = """# Hermez AI chat bot — production env (VPS)
TELEGRAM_BOT_TOKEN=8783501911:AAGHVvXDH2Fqyr09YAUz7EQpxjOAZiSO8Zc
TELEGRAM_OWNER_IDS=5721500978
TELEGRAM_OPEN_ACCESS=true
TELEGRAM_BOT_SECRET=1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52

LLM_API_KEY=ce6c4c70f8a149d4b223ca70928d1102.puLdC5RjBegXZJCtdU2PTlIP
LLM_BASE_URL=https://ollama.com/v1
LLM_MODEL=deepseek-v4-flash
LLM_VISION_MODEL=minimax-m3
LLM_LITE_MODEL=deepseek-v4-flash

YKP_FINANCE_URL=http://localhost:3009
YKP_HR_URL=http://localhost:3008
YKP_WAREHOUSE_URL=http://localhost:3005
YKP_OPS_URL=http://localhost:3007
YKP_INVESTOR_URL=http://localhost:3006

HERMEZ_DATA_DIR=/home/dev/ykp/ykp-hermez/data
"""

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)
sftp = ssh.open_sftp()
with sftp.open('/home/dev/ykp/ykp-hermez/.env', 'w') as f:
    f.write(ENV)
sftp.close()
ssh.close()
print('WROTE .env')
