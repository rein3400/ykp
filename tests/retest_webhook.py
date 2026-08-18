import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# 1. Send webhook test
import json
payload = json.dumps({
    "update_id": 99,
    "message": {
        "message_id": 99,
        "chat": {"id": 5721500978, "type": "private"},
        "text": "/masuk",
        "location": {"latitude": -6.2741, "longitude": 106.8006}
    }
})

cmd = f"""curl -s -X POST https://oseedigital.tech/api/hr/attendance/telegram \
  -H 'X-Telegram-Bot-Api-Secret-Token: 1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52' \
  -H 'Content-Type: application/json' \
  -d '{payload}' -w '\\nHTTP %{{http_code}}\\n'"""
stdin, stdout, stderr = ssh.exec_command(cmd)
print('WEBHOOK RESPONSE:\n' + stdout.read().decode())
err = stderr.read().decode()
if err:
    print('STDERR:\n' + err)

# 2. Check recent out log for route errors
cmd2 = r"""
export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
tail -n 30 /home/dev/.pm2/logs/ykp-hr-v1-out.log
"""
stdin, stdout, stderr = ssh.exec_command(cmd2)
print('OUT LOG:\n' + stdout.read().decode())

ssh.close()
