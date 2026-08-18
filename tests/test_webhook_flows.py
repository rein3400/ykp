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

# Test 1: /masuk kedua kali (idempotent)
print('=== TEST 1: /masuk kedua (idempotent) ===')
print(send({
    "update_id": 100,
    "message": {"message_id": 100, "chat": {"id": 5721500978, "type": "private"}, "text": "/masuk", "location": {"latitude": -6.2741, "longitude": 106.8006}}
}))

# Test 2: /masuk di luar radius (harus ditolak)
print('=== TEST 2: /masuk di luar radius ===')
print(send({
    "update_id": 101,
    "message": {"message_id": 101, "chat": {"id": 5721500978, "type": "private"}, "text": "/masuk", "location": {"latitude": -6.3000, "longitude": 106.9000}}
}))

# Test 3: /pulang
print('=== TEST 3: /pulang ===')
print(send({
    "update_id": 102,
    "message": {"message_id": 102, "chat": {"id": 5721500978, "type": "private"}, "text": "/pulang"}
}))

# Test 4: /help
print('=== TEST 4: /help ===')
print(send({
    "update_id": 103,
    "message": {"message_id": 103, "chat": {"id": 5721500978, "type": "private"}, "text": "/help"}
}))

ssh.close()
