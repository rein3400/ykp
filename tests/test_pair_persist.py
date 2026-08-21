import urllib.request
import json
import http.cookiejar

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

# 2. get link code (now persisted to Sheets)
s, b = post('/api/hr/telegram/link', {})
print('LINK', s, b[:200])
code = json.loads(b)['data']['code']
print('CODE:', code)

# 3. simulate Telegram webhook: /start CODE from a fresh chat id
fake_update = {
    'update_id': 999001,
    'message': {
        'message_id': 1,
        'chat': {'id': 777000111, 'username': 'pairtest'},
        'text': f'/start {code}'
    }
}
s, b = post('/api/hr/attendance/telegram', fake_update, headers={'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET})
print('WEBHOOK /start CODE:', s, b[:300])

# 4. verify the code is now consumed (re-send should fail with "kode tidak valid")
s2, b2 = post('/api/hr/attendance/telegram', fake_update, headers={'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET})
print('WEBHOOK re-send (should be invalid):', s2, b2[:300])
