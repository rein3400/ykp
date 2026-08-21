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

# Use the owner's bound chat id (777000111 from earlier test) to simulate
# the employee EMP-001 (owner is linked to EMP-001).
CHAT = 777000111

# 1. /masuk without location → should ask for location (not clock in)
s, b = post('/api/hr/attendance/telegram', {
    'update_id': 1,
    'message': {'message_id': 1, 'chat': {'id': CHAT}, 'text': '/masuk'}
}, headers={'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET})
print('/masuk (no loc):', s, b[:200])

# 2. send location → should clock in with INSIDE/OUTSIDE radius
s, b = post('/api/hr/attendance/telegram', {
    'update_id': 2,
    'message': {
        'message_id': 2,
        'chat': {'id': CHAT},
        'location': {'latitude': -6.2741, 'longitude': 106.8006}
    }
}, headers={'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET})
print('location:', s, b[:300])
