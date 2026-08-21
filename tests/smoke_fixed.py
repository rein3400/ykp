"""Smoke test the 5 fixed apps after deploy.
Checks: homepage 200, login page 200, public summary GET 200, SSO ops reject no-token.
"""
import urllib.request, urllib.error, sys

BASES = {
    "hr": "https://hr-v1.oseedigital.tech",
    "finance": "https://finance-v1.oseedigital.tech",
    "warehouse": "https://warehouse.oseedigital.tech",
    "investor": "https://investor.oseedigital.tech",
    "ops": "https://ops.oseedigital.tech",
}

def get(url, headers=None, allow_redirects=True, timeout=15):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        # urllib follows redirects by default; to inspect, use HTTPRedirectHandler noop
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()[:200]
    except urllib.error.HTTPError as e:
        return e.code, (e.read() or b"")[:200]
    except Exception as e:
        return 0, str(e).encode()

print("=== Homepages ===")
for app, base in BASES.items():
    code, body = get(base + "/")
    print(f"{app:10} / -> {code}")

print("\n=== Login pages ===")
for app, base in BASES.items():
    code, body = get(base + "/login")
    print(f"{app:10} /login -> {code}")

print("\n=== Public summary (Hermez-facing) ===")
for path in [
    ("hr", "/api/hr/summary?date=2026-08-21"),
    ("finance", "/api/finance/summary"),
    ("warehouse", "/api/warehouse/summary"),
    ("investor", "/api/investor/summary"),
    ("ops", "/api/ops/summary"),
]:
    app, p = path
    code, body = get(BASES[app] + p)
    print(f"{app:10} {p} -> {code}")

print("\n=== Audit redaction (beforeValue should be gone) ===")
for app, p in [
    ("hr", "/api/hr/audit?limit=3"),
    ("finance", "/api/finance/audit?limit=3"),
    ("investor", "/api/investor/audit?limit=3"),
]:
    code, body = get(BASES[app] + p)
    has_before = b"beforeValue" in body
    print(f"{app:10} {p} -> {code}  beforeValue_in_body={has_before}")

print("\n=== Ops SSO auth bypass (should now 401 without token) ===")
# Without token — old behavior mints owner; new should 401
code, body = get(BASES["ops"] + "/api/auth/login?role=OWNER&redirect=/", allow_redirects=False)
print(f"ops SSO no-token -> {code}  body={body[:120]}")

# With wrong token
code, body = get(BASES["ops"] + "/api/auth/login?role=OWNER&token=wrong&redirect=/", allow_redirects=False)
print(f"ops SSO wrong-token -> {code}  body={body[:120]}")

# With correct token
code, body = get(BASES["ops"] + "/api/auth/login?role=OWNER&token=1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52&redirect=/", allow_redirects=False)
print(f"ops SSO correct-token -> {code}  body={body[:120]}")