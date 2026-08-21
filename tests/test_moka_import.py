import urllib.request
import json
import http.cookiejar

BASE = 'https://finance-v1.oseedigital.tech'

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def post(path, body):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    try:
        res = opener.open(req, timeout=30)
        return res.status, res.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# login
s, b = post('/api/auth/login', {'username': 'owner', 'password': 'owner123'})
print('LOGIN', s, b[:200])

# Moka CSV sample with a REGISTERED outlet (Sekarpizza Demangan)
csv = """date,outlet_name,gross_sales,net_sales,discount,refund,void,tax,service_charge,transaction_count,payment_method,settlement_cash,settlement_qris
2026-08-18,Sekarpizza Demangan,1500000,1450000,50000,0,0,0,0,50,Cash,1450000,0
"""

s, b = post('/api/finance/pos/import', {'csv': csv, 'dryRun': True})
print('MOKA IMPORT (dryRun)', s, b[:600])
