import json
import urllib.request

URL = 'https://oseedigital.tech/api/hr/attendance/telegram'
SECRET = '1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52'

# Far location: Jakarta (outlet is in Bandung area ~ -6.27, 106.8)
payload = {
    'update_id': 999001,
    'message': {
        'message_id': 999001,
        'from': {'id': 5721500978, 'is_bot': False, 'first_name': 'Owner'},
        'chat': {'id': 5721500978, 'type': 'private'},
        'date': 1755500000,
        'text': '/masuk',
        'location': {'latitude': -6.2088, 'longitude': 106.8456}
    }
}

req = urllib.request.Request(
    URL,
    data=json.dumps(payload).encode(),
    headers={
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': SECRET
    },
    method='POST'
)
try:
    resp = urllib.request.urlopen(req, timeout=30)
    print('STATUS', resp.status)
    print(resp.read().decode())
except urllib.error.HTTPError as e:
    print('HTTP', e.code)
    print(e.read().decode())
