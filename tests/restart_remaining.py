"""Restart the 3 apps whose PM2 names differ from folder names."""
import paramiko
import time

PATH_EXPORT = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH"
MAP = [
    ("ykp-investor-v1", "ykp-investor"),
    ("ykp-ops-v1", "ykp-ops"),
    ("ykp-warehouse-v1", "ykp-warehouse"),
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("187.77.114.168", username="dev", password="password", timeout=30)


def run(cmd, t=60):
    _, o, e = ssh.exec_command(cmd, timeout=t)
    return o.read().decode() + e.read().decode()


for folder, pm2_name in MAP:
    print(f"=== restart {folder} (pm2: {pm2_name}) ===")
    print(run(f"{PATH_EXPORT}; pm2 restart {pm2_name} --update-env 2>&1 | tail -4").strip())
    time.sleep(3)
    status = run(
        f"{PATH_EXPORT}; pm2 jlist 2>/dev/null | python3 -c \"import sys,json; d=json.load(sys.stdin); print(next((p['pm2_env']['status'] for p in d if p['name']=='{pm2_name}'),'NF'))\"",
        30).strip()
    print(f"  pm2 status: {status}")

print("\n=== HEALTH ===")
ports = {"ykp-investor": 3006, "ykp-ops": 3007, "ykp-warehouse": 3005}
for name, port in ports.items():
    h = run(f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{port}/ 2>&1").strip()
    print(f"{name} (:{port}) -> HTTP {h}")
ssh.close()