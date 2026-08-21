"""Post-merge sanity: confirm all 6 VPS apps healthy + absen webhook reachable."""
import paramiko
PATH = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=20)


def run(cmd, t=30):
    _, o, e = c.exec_command(cmd, timeout=t)
    return o.read().decode() + e.read().decode()


print("=== PM2 status ===")
print(run(f"{PATH}; pm2 jlist 2>/dev/null | python3 -c \""
          "import sys,json; d=json.load(sys.stdin); "
          "[print(p['name'], p['pm2_env']['status']) for p in d]\""))

print("\n=== Health (root redirect = up) ===")
ports = {"ykp-hr-v1": 3008, "ykp-finance-v1": 3009, "ykp-investor-v1": 3006,
         "ykp-ops-v1": 3007, "ykp-warehouse-v1": 3005, "ykp-hermez-bot": 3004}
for app, port in ports.items():
    h = run(f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{port}/ 2>&1").strip()
    print(f"{app} (:{port}) -> HTTP {h}")

print("\n=== absen webhook reachability (GET should 405, not 502) ===")
h = run("curl -s -o /dev/null -w '%{http_code}' http://localhost:3008/api/hr/attendance/telegram 2>&1").strip()
print(f"HR absen webhook GET -> HTTP {h}")

print("\n=== HR summary endpoint (hermez-facing public read) ===")
h = run("curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3008/api/hr/summary?date=2026-08-21' 2>&1").strip()
print(f"HR summary GET -> HTTP {h}")
c.close()