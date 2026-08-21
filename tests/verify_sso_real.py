"""Verify ops SSO with the REAL hub token (ykp_sso_secret_2024_prod_v1)."""
import urllib.request, urllib.error

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

BASE = "https://ops.oseedigital.tech"
TOKEN = "ykp_sso_secret_2024_prod_v1"
for label, tok in [("no-token", None), ("wrong", "bad"), ("hub-real", TOKEN), ("old-bot-secret", "1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52")]:
    url = f"{BASE}/api/auth/login?role=OWNER&redirect=/"
    if tok: url += f"&token={tok}"
    req = urllib.request.Request(url)
    try:
        opener = urllib.request.build_opener(NoRedirect)
        r = opener.open(req, timeout=15)
        print(f"  {label:16} -> {r.status}  (redirect OK)")
    except urllib.error.HTTPError as e:
        print(f"  {label:16} -> {e.code}  {e.read()[:80]}")