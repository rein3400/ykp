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

# Test 1: /masuk WITHOUT location (should ask for location)
print('=== TEST 1: /masuk tanpa lokasi (harus minta lokasi) ===')
print(send({
    "update_id": 400,
    "message": {"message_id": 400, "chat": {"id": 5721500978, "type": "private"}, "text": "/masuk"}
}))

# Test 2: /masuk WITH location inside radius (should succeed)
print('=== TEST 2: /masuk dengan lokasi dalam radius (harus sukses) ===')
print(send({
    "update_id": 401,
    "message": {"message_id": 401, "chat": {"id": 5721500978, "type": "private"}, "text": "/masuk", "location": {"latitude": -6.2741, "longitude": 106.8006}}
}))

ssh.close()
