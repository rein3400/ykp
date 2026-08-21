import urllib.request, urllib.error

urls = [
    ("HR", "https://hr-v1.oseedigital.tech/hr/telegram"),
    ("Finance", "https://finance-v1.oseedigital.tech/finance/telegram"),
    ("Warehouse", "https://warehouse.oseedigital.tech/warehouse/telegram"),
    ("Investor", "https://investor.oseedigital.tech/investor/telegram"),
    ("Ops", "https://ops.oseedigital.tech/ops/telegram"),
]

for name, url in urls:
    try:
        req = urllib.request.Request(url, method='GET', headers={'User-Agent': 'Mozilla/5.0'})
        resp = urllib.request.urlopen(req, timeout=30)
        final = resp.geturl()
        body = resp.read().decode('utf-8', errors='replace')
        has_telegram = 'Telegram' in body or 'telegram' in body
        print(f"{name}: status={resp.status} final_url={final} len={len(body)} contains_telegram={has_telegram}")
    except urllib.error.HTTPError as e:
        print(f"{name}: HTTP {e.code} (redirect to login expected)")
    except Exception as e:
        print(f"{name}: ERROR {e}")
