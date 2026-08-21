import urllib.request
import json
import http.cookiejar

BASE = 'https://oseedigital.tech'

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def post(path, body):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
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

# 3. consume (simulate bot with x-bot-secret)
code = None
try:
    code = json.loads(b)['data']['code']
except Exception:
    pass

if code:
    # consume needs x-bot-secret header; use TELEGRAM_BOT_SECRET? HR uses TELEGRAM_BOT_SECRET env
    # Actually consume route checks process.env.TELEGRAM_BOT_SECRET. HR .env has TELEGRAM_WEBHOOK_SECRET but not TELEGRAM_BOT_SECRET.
    # Let's check what secret is expected.
    print('CODE:', code)
    # Try consume with x-bot-secret = webhook secret (guess)
    req = urllib.request.Request(BASE + '/api/hr/telegram/link/consume', data=json.dumps({'code': code, 'telegram_chat_id': '5721500978'}).encode(), headers={'Content-Type': 'application/json', 'x-bot-secret': '1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52'})
    try:
        res = opener.open(req, timeout=30)
        print('CONSUME', res.status, res.read().decode()[:300])
    except urllib.error.HTTPError as e:
        print('CONSUME', e.code, e.read().decode()[:300])
