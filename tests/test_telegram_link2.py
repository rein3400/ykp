import urllib.request
import json
import http.cookiejar

BASE = 'https://hr-v1.oseedigital.tech'

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
print('LOGIN', s, b[:300])

# 2. get link code
s, b = post('/api/hr/telegram/link', {})
print('LINK', s, b[:300])

code = None
try:
    code = json.loads(b)['data']['code']
except Exception:
    pass

if code:
    print('CODE:', code)
    # 3. consume with x-bot-secret (HR consume route checks TELEGRAM_BOT_SECRET env)
    # HR .env has TELEGRAM_WEBHOOK_SECRET but NOT TELEGRAM_BOT_SECRET. Check.
    s, b = post('/api/hr/telegram/link/consume', {'code': code, 'telegram_chat_id': '5721500978'}, headers={'x-bot-secret': '1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52'})
    print('CONSUME', s, b[:300])
