"""Extract the actual module URLs baked into the hub production client bundle.
Fetches hub pages, finds JS chunks, greps for ykp-* URLs / NEXT_PUBLIC_YKP refs.
"""
import re, urllib.request, sys

BASE = "https://ykp-hub-production.up.railway.app"
# Try common entry paths
paths = ["/", "/login", "/dashboard"]
html = ""
for p in paths:
    try:
        html = urllib.request.urlopen(BASE + p, timeout=20).read().decode("utf-8", "ignore")
        if html:
            break
    except Exception as e:
        print(f"  {p} fail: {e}", file=sys.stderr)

if not html:
    print("NO HTML FETCHED"); sys.exit(1)

# extract script srcs
scripts = re.findall(r'src="([^"]+\.js)"', html)
print("SCRIPTS:", scripts[:8])

# url pattern for ykp module urls
url_pat = re.compile(r'https?://[a-zA-Z0-9.\-]+(?:vercel\.app|railway\.app|oseedigital\.tech)[^\s"\']*')
found = set()
for s in scripts:
    full = s if s.startswith("http") else BASE + ("" if s.startswith("/") else "/") + s
    try:
        js = urllib.request.urlopen(full, timeout=30).read().decode("utf-8", "ignore")
    except Exception as e:
        print(f"  js {s} fail: {e}", file=sys.stderr)
        continue
    for m in url_pat.findall(js):
        found.add(m)

print("\nURLs found in bundle:")
for u in sorted(found):
    print(" ", u)

# also look for NEXT_PUBLIC_YKP_*
env_refs = set()
for s in scripts:
    full = s if s.startswith("http") else BASE + ("" if s.startswith("/") else "/") + s
    try:
        js = urllib.request.urlopen(full, timeout=30).read().decode("utf-8", "ignore")
    except Exception:
        continue
    for m in re.findall(r'NEXT_PUBLIC_YKP_[A-Z_]+', js):
        env_refs.add(m)
print("\nNEXT_PUBLIC refs:", sorted(env_refs))