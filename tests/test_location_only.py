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

# Test: location-only message (no text) — should clock in
print('=== TEST: share lokasi tanpa text (harus clock-in) ===')
print(send({
    "update_id": 500,
    "message": {"message_id": 500, "chat": {"id": 5721500978, "type": "private"}, "location": {"latitude": -6.2741, "longitude": 106.8006}}
}))

ssh.close()
