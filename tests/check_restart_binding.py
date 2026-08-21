import paramiko

HOST = "187.77.114.168"
USER = "dev"
PWD = "password"

cmd = (
    "cd /home/dev/ykp/ykp-hr-v1 && export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin && "
    "set -a && . ./.env && set +a && "
    "npx tsx -e \""
    "import { readTab, TABS } from './src/db/sheets';"
    "(async () => {"
    "  const codes = await readTab(TABS.telegramLinkCodes);"
    "  console.log('LINK_CODES', JSON.stringify(codes));"
    "  const users = await readTab(TABS.users);"
    "  const u = users.find(x => x.user_id === 'U-001');"
    "  console.log('OWNER_TELEGRAM_ID', u && u.telegram_id);"
    "})();\""
)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PWD, timeout=30)
stdin, stdout, stderr = c.exec_command(cmd, timeout=90)
out = stdout.read().decode()
err = stderr.read().decode()
print("STDOUT:", out)
print("STDERR:", err)
c.close()
