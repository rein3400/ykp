import urllib.request
import json
import http.cookiejar
import paramiko
import time

BASE = 'https://hr-v1.oseedigital.tech'
WEBHOOK_SECRET = '1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52'

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def post(path, body, headers=None):
    h = {'Content-Type': 'application/json'}
    if headers: h.update(headers)
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers=h)
    try:
        res = opener.open(req, timeout=30)
        return res.status, res.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# 1. login
s, b = post('/api/auth/login', {'username': 'owner', 'password': 'owner123'})
print('LOGIN', s)

# 2. generate code
s, b = post('/api/hr/telegram/link', {})
code = json.loads(b)['data']['code']
print('CODE:', code)

# 3. restart HR app (clears any in-memory state)
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('187.77.114.168', username='dev', password='password', timeout=30)
stdin, stdout, stderr = c.exec_command(
    "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin; pm2 restart ykp-hr-v1 --update-env",
    timeout=60
)
print('RESTART:', stdout.read().decode().strip())
c.close()
time.sleep(8)

# 4. consume the SAME code after restart (should still work)
fake_update = {
    'update_id': 999002,
    'message': {
        'message_id': 1,
        'chat': {'id': 555000222, 'username': 'restarttest'},
        'text': f'/start {code}'
    }
}
s, b = post('/api/hr/attendance/telegram', fake_update, headers={'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET})
print('WEBHOOK after restart:', s, b[:200])
