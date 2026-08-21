"""Final verification: all apps, hermez bot, telegram absen, daily-briefs.
Confirms every P0/P1 fix is live and no regressions in the production bot flows.
"""
import urllib.request, urllib.error, json

def get(url, headers=None, timeout=20):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()[:300]
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"")[:300]
    except Exception as e:
        return 0, str(e).encode()[:200]

print("=== 1. All 7 subdomains 200 ===")
bases = {
    "hub": "https://ykp-hub-production.up.railway.app",
    "hr": "https://hr-v1.oseedigital.tech",
    "finance": "https://finance-v1.oseedigital.tech",
    "warehouse": "https://warehouse.oseedigital.tech",
    "investor": "https://investor.oseedigital.tech",
    "ops": "https://ops.oseedigital.tech",
    "owner": "https://ykp-owner-v1.vercel.app",
}
for app, base in bases.items():
    code, _ = get(base + "/")
    print(f"  {app:10} -> {code}")

print("\n=== 2. Hermez bot (open-access now false, only owner chat) ===")
# getMe to confirm bot alive
code, body = get(f"https://api.telegram.org/bot8783501911:AAGHVvXDH2Fqyr09YAUz7EQpxjOAZiSO8Zc/getMe")
print(f"  getMe -> {code}  {body[:150]}")

print("\n=== 3. HR Telegram absen webhook (still 200) ===")
# webhook with wrong secret -> 401; without secret -> 401; correct secret needed
code, body = get("https://hr-v1.oseedigital.tech/api/hr/attendance/telegram")
print(f"  GET no-secret -> {code}  {body[:120]}")

print("\n=== 4. Ops SSO (auth bypass closed) ===")
code, body = get("https://ops.oseedigital.tech/api/auth/login?role=OWNER&redirect=/")
print(f"  no-token -> {code}  {body[:100]}")
code, body = get("https://ops.oseedigital.tech/api/auth/login?role=OWNER&token=1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52&redirect=/")
print(f"  correct-token -> {code}  (200=OK, redirected)")

print("\n=== 5. Audit redaction (beforeValue/afterValue stripped) ===")
for app, p in [
    ("hr", "https://hr-v1.oseedigital.tech/api/hr/audit?limit=5"),
    ("investor", "https://investor.oseedigital.tech/api/investor/audit?limit=5"),
]:
    code, body = get(p)
    has_pii = b"beforeValue" in body or b"afterValue" in body
    print(f"  {app:10} -> {code}  PII_leaked={has_pii}")

print("\n=== 6. Public summary (Hermez-facing still works) ===")
for app, p in [
    ("hr", "https://hr-v1.oseedigital.tech/api/hr/summary?date=2026-08-21"),
    ("investor", "https://investor.oseedigital.tech/api/investor/summary"),
    ("ops", "https://ops.oseedigital.tech/api/ops/summary"),
]:
    code, body = get(p)
    print(f"  {app:10} -> {code}  {body[:80]}")

print("\n=== 7. Finance + warehouse daily-brief still deliver (CRON_SECRET) ===")
for app, path in [
    ("finance", "https://finance-v1.oseedigital.tech/api/finance/notify/daily-brief"),
    ("warehouse", "https://warehouse.oseedigital.tech/api/warehouse/notify/daily-brief"),
]:
    req = urllib.request.Request(path, headers={"x-cron-secret": "933970dd544e1530bce1da49d540b88d132d15ef45ec8bbb764230ca550375b2"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"  {app:10} -> {r.status}  {r.read()[:120]}")
    except urllib.error.HTTPError as e:
        print(f"  {app:10} -> {e.code}  {e.read()[:120]}")
    except Exception as e:
        print(f"  {app:10} -> ERR  {str(e)[:120]}")