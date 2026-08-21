"""Extract NEXT_PUBLIC_ERP_SSO_SECRET from hub production client bundle."""
import re, sys, urllib.request

url = "https://ykp-hub-production.up.railway.app/"
try:
    html = urllib.request.urlopen(url, timeout=30).read().decode("utf-8", "ignore")
except Exception as e:
    print("FETCH FAIL:", e); sys.exit(1)

# find token= values in raw html
toks = re.findall(r"token=([^&\"\\s]+)", html)
print("TOKEN values:", toks[:5])

# find script srcs
scripts = re.findall(r'src="([^"]+\.js)"', html)
print("SCRIPTS:", scripts[:5])

# fetch each script and search for ERP_SSO_SECRET usage / token literal
for s in scripts:
    if not s.startswith("http"):
        s = url.rstrip("/") + "/" + s.lstrip("/")
    try:
        js = urllib.request.urlopen(s, timeout=30).read().decode("utf-8", "ignore")
    except Exception as e:
        print("JS fetch fail", s, e); continue
    # NEXT_PUBLIC_ are inlined usually as literal string assignments
    m = re.findall(r'["\']([0-9a-f]{16,64})["\']', js)
    if m:
        print(f"{s} hex-literals({len(m)}):", m[:8])
    m2 = re.findall(r'(ERP_SSO_SECRET|sso_secret|SSO_SECRET)', js, re.I)
    if m2:
        print(f"{s} sso-refs:", m2[:5])