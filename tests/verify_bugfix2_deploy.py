"""Verify the bugfix2 deploy: PM2 status, health endpoints, and spot-check
that specific fixes are live on the VPS-resident apps.

Apps on VPS (ports): hr-v1 3008, finance-v1 3009, warehouse 3005,
investor 3006, ops 3007, hermez-bot (no HTTP, poll loop).
"""
import paramiko, sys

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"
PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=30)


def run(cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    return stdout.read().decode().strip(), stderr.read().decode().strip()


print("===== PM2 STATUS (bugfix apps) =====")
out, _ = run(f"export PATH={PATH}; pm2 list 2>&1")
# Print only relevant lines
for line in out.splitlines():
    if any(a in line for a in ["ykp-hr-v1", "ykp-finance-v1", "ykp-warehouse", "ykp-investor", "ykp-ops", "ykp-hermez-bot"]):
        print(line)

print("\n===== HEALTH ENDPOINTS =====")
endpoints = [
    ("hr-v1 login", "curl -s -o /dev/null -w '%{http_code}' http://localhost:3008/login"),
    ("finance-v1 login", "curl -s -o /dev/null -w '%{http_code}' http://localhost:3009/login"),
    ("warehouse login", "curl -s -o /dev/null -w '%{http_code}' http://localhost:3005/login"),
    ("investor login", "curl -s -o /dev/null -w '%{http_code}' http://localhost:3006/login"),
    ("ops login", "curl -s -o /dev/null -w '%{http_code}' http://localhost:3007/login"),
    ("hr-v1 summary (public)", "curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3008/api/hr/summary?date=2026-08-21'"),
    ("ops summary (public)", "curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3007/api/ops/summary?date=2026-08-21'"),
    ("investor summary (public)", "curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3006/api/investor/summary'"),
]
for name, cmd in endpoints:
    out, err = run(cmd)
    print(f"  {name}: {out} {err if err else ''}")

print("\n===== SPOT-CHECK FIXES =====")

# Finance audit redaction (bug #1): public GET should not leak before_value/after_value
out, _ = run("curl -s 'http://localhost:3009/api/finance/audit' | head -c 600")
print(f"\n  finance audit (first 600 chars):\n  {out}")
if "before_value" in out or "after_value" in out:
    print("  [WARN] before_value/after_value still present in audit response (may be ok if no rows)")
else:
    print("  [OK] no before_value/after_value keys in audit response")

# Ops summary no-date fallback (bug #3): far-future date should return empty
out, _ = run("curl -s 'http://localhost:3007/api/ops/summary?date=2099-12-31' | head -c 300")
print(f"\n  ops summary 2099: {out}")
if '"items":[]' in out or '"data":[]' in out or '"total":0' in out:
    print("  [OK] empty list for no-data date (no cross-date leak)")
else:
    print("  [INFO] check format above — should be empty for 2099")

# Investor summary no-date (bug #1): should not return stale rows
out, _ = run("curl -s 'http://localhost:3006/api/investor/summary' | head -c 300")
print(f"\n  investor summary (no date): {out}")

# HR correction RBAC (bug #3): unauthenticated should 401
out, _ = run("curl -s -o /dev/null -w '%{http_code}' -X POST 'http://localhost:3008/api/hr/attendance/correction' -H 'Content-Type: application/json' -d '{}'")
print(f"\n  hr correction unauth: {out} (expect 401)")

# Warehouse receiving qty_accepted > qty_delivered (bug #13): should 400
out, _ = run("curl -s -o /dev/null -w '%{http_code}' -X POST 'http://localhost:3005/api/warehouse/receiving' -H 'Content-Type: application/json' -d '{\"items\":[{\"item_id\":\"x\",\"qty_delivered\":10,\"qty_accepted\":15}]}'")
print(f"  warehouse receiving accepted>delivered: {out} (expect 400 or 401/403 if auth needed)")

ssh.close()
print("\nDONE")