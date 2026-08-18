import paramiko
import json

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

SECRET = '1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52'
URL = 'https://oseedigital.tech/api/hr/attendance/telegram'

def send(payload):
    cmd = f"""curl -s -X POST {URL} -H 'X-Telegram-Bot-Api-Secret-Token: {SECRET}' -H 'Content-Type: application/json' -d '{json.dumps(payload)}' -w '\\nHTTP %{{http_code}}\\n'"""
    stdin, stdout, stderr = ssh.exec_command(cmd)
    return stdout.read().decode()

# Test: /pulang — should clock out ATT-256 (today), not ATT-246
print('=== TEST: /pulang (should target today ATT-256) ===')
print(send({
    "update_id": 200,
    "message": {"message_id": 200, "chat": {"id": 5721500978, "type": "private"}, "text": "/pulang"}
}))

ssh.close()
