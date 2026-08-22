#!/usr/bin/env python3
"""One-shot deploy: switch all 5 V1 apps on the VPS from Google Sheets to PostgreSQL.

Steps per app:
  1. SFTP upload src/db/postgres.ts + patched src/db/sheets.ts + package.json
  2. Append USE_POSTGRES=true + DATABASE_URL to the app .env (idempotent)
  3. npm install (pulls `pg`), npm run build
  4. systemctl restart <service>

Then verify: services active, login pages reachable, Postgres row counts.

Usage:  python tests/deploy_pg_migration.py [--app hr|finance|warehouse|investor|ops|all]
"""
import sys
import time

import paramiko

VPS = ("187.52.124.40", "dev", "password")
DATABASE_URL = "postgresql://ykp:ykp12345@localhost:5432/ykp_v1"

APPS = {
    "hr": {
        "local": "ykp-hr-v1",
        "dir": "/home/dev/ykp/ykp-hr-v1",
        "service": "ykp-hr-v1",
        "port": 3002,
    },
    "finance": {
        "local": "ykp-finance-v1",
        "dir": "/home/dev/ykp/ykp-finance-v1",
        "service": "ykp-finance-v1",
        "port": 3003,
    },
    "warehouse": {
        "local": "ykp-warehouse-v1",
        "dir": "/home/dev/ykp/ykp-warehouse-v1",
        "service": "ykp-warehouse-v1",
        "port": 3005,
    },
    "investor": {
        "local": "ykp-investor-v1",
        "dir": "/home/dev/ykp/ykp-investor-v1",
        "service": "ykp-investor-v1",
        "port": 3006,
    },
    "ops": {
        "local": "ykp-ops-v1",
        "dir": "/home/dev/ykp/ykp-ops-v1",
        "service": "ykp-ops-v1",
        "port": 3007,
    },
}

FILES = [
    "src/db/postgres.ts",
    "src/db/sheets.ts",
    "package.json",
]


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(VPS[0], 22, VPS[1], VPS[2], timeout=25, banner_timeout=25, auth_timeout=25)
    return c


def run(c, cmd, timeout=600):
    _, out, err = c.exec_command(cmd, timeout=timeout)
    o = out.read().decode(errors="replace")
    e = err.read().decode(errors="replace")
    return o, e


def deploy_app(c, key, local_root):
    cfg = APPS[key]
    d = cfg["dir"]
    sftp = c.open_sftp()
    for rel in FILES:
        local = f"{local_root}/{cfg['local']}/{rel}"
        remote = f"{d}/{rel}"
        sftp.put(local, remote)
        print(f"  uploaded {rel}")
    sftp.close()

    env = f"{d}/.env"
    cur, _ = run(c, f"cat {env} 2>/dev/null | grep -c '^USE_POSTGRES=' || true")
    if cur.strip() == "0":
        run(c, f"printf '\\nUSE_POSTGRES=true\\nDATABASE_URL={DATABASE_URL}\\n' >> {env}")
        print(f"  .env: USE_POSTGRES appended")
    else:
        run(c, f"sed -i 's|^USE_POSTGRES=.*|USE_POSTGRES=true|; s|^DATABASE_URL=.*|DATABASE_URL={DATABASE_URL}|' {env}")
        print(f"  .env: USE_POSTGRES updated")

    print("  npm install...")
    o, e = run(c, f"cd {d} && npm install --no-audit --no-fund 2>&1 | tail -2")
    print("  " + o.strip().replace("\n", " | "))

    print("  build...")
    o, e = run(c, f"cd {d} && npm run build 2>&1 | tail -4", timeout=900)
    tail = o.strip().splitlines()
    print("  " + (tail[-1] if tail else "(no output)"))
    if "error" in o.lower() and "0 error" not in o.lower():
        print("  BUILD OUTPUT TAIL:\n" + "\n".join(tail))
        return False

    run(c, f"echo password | sudo -S systemctl restart {cfg['service']} 2>&1")
    time.sleep(4)
    o, _ = run(c, f"systemctl is-active {cfg['service']}")
    status = o.strip()
    print(f"  service: {status}")
    return status == "active"


def verify(c):
    print("\n=== VERIFY ===")
    for key, cfg in APPS.items():
        o, _ = run(c, f"systemctl is-active {cfg['service']}")
        code, _ = run(c, f"curl -s -o /dev/null -w '%{{http_code}}' --max-time 8 http://localhost:{cfg['port']}/login")
        print(f"  {key:10s} service={o.strip():8s} login={code.strip()}")
    o, _ = run(c, "curl -s -o /dev/null -w '%{http_code}' --max-time 8 https://hr-v1.oseedigital.tech/login")
    print(f"  hr-v1 https login = {o.strip()}")
    o, _ = run(
        c,
        "PGPASSWORD=ykp12345 psql -h localhost -U ykp -d ykp_v1 -t -c "
        "\"SELECT 'hr_attendance='||count(*) FROM hr_attendance "
        "UNION ALL SELECT 'users='||count(*) FROM users "
        "UNION ALL SELECT 'fin_pos_daily='||count(*) FROM fin_pos_daily\"",
    )
    print("  pg rows:\n    " + "\n    ".join(x.strip() for x in o.strip().splitlines() if x.strip()))


def main():
    local_root = r"D:\Users\stefa\Project\YKP HERMEZ AI COMMAND CENTER"
    which = "all"
    if "--app" in sys.argv:
        which = sys.argv[sys.argv.index("--app") + 1]
    targets = list(APPS) if which == "all" else [which]

    c = connect()
    ok = True
    for key in targets:
        print(f"\n=== deploy {key} ===")
        try:
            if not deploy_app(c, key, local_root):
                ok = False
                print(f"!! {key} deploy failed, stopping")
                break
        except Exception as ex:
            ok = False
            print(f"!! {key} exception: {ex}")
            break
    if ok:
        verify(c)
    c.close()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
