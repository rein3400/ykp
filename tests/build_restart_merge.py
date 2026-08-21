"""Build + restart the 5 apps affected by the SKIP-DEV merge.

Apps: ykp-hr-v1, ykp-finance-v1, ykp-investor-v1, ykp-ops-v1, ykp-warehouse-v1.

Each: cd into app dir, npm run build (writes to dist/ for hermez; for Next.js
apps it compiles), then pm2 restart. We capture the full build log to a
/tmp file and grep for success/error markers so we don't get a false FAIL
from tail eating the success line.
"""
import paramiko
import time

HOST = "187.77.114.168"
USER = "dev"
PWD = "password"
PATH_EXPORT = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin:$PATH"

APPS = [
    ("ykp-hr-v1", "/home/dev/ykp/ykp-hr-v1"),
    ("ykp-finance-v1", "/home/dev/ykp/ykp-finance-v1"),
    ("ykp-investor-v1", "/home/dev/ykp/ykp-investor-v1"),
    ("ykp-ops-v1", "/home/dev/ykp/ykp-ops-v1"),
    ("ykp-warehouse-v1", "/home/dev/ykp/ykp-warehouse-v1"),
]


def run(c, cmd, timeout=300):
    _, o, e = c.exec_command(cmd, timeout=timeout)
    return o.read().decode() + e.read().decode()


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PWD, timeout=30)

    results = []
    for app, path in APPS:
        log = f"/tmp/_build_{app}.log"
        build_cmd = (
            f"{PATH_EXPORT}; cd {path} && "
            f"(npm run build > {log} 2>&1; echo \"EXIT=$?\" >> {log})"
        )
        # Run build synchronously (timeout 300s per app).
        print(f"=== BUILD {app} ===")
        out = run(ssh, build_cmd, timeout=600)
        # Read the log tail + look for markers.
        log_content = run(ssh, f"tail -40 {log}")
        exit_line = run(ssh, f"grep '^EXIT=' {log} || echo EXIT=MISSING")
        print(exit_line.strip())
        # Look for common success/error markers.
        has_compiled = "Compiled successfully" in log_content or "Compiled successfully" in run(ssh, f"grep -c 'Compiled successfully' {log}")
        has_error = "Type error" in log_content or "Failed to compile" in log_content
        build_ok = ("EXIT=0" in exit_line) and not has_error
        if not build_ok:
            print(log_content[-3000:])
            results.append((app, "BUILD_FAIL", ""))
            continue
        # Restart PM2.
        restart_cmd = f"{PATH_EXPORT}; pm2 restart {app} --update-env 2>&1 | tail -5"
        r_out = run(ssh, restart_cmd, timeout=60)
        print(r_out.strip())
        time.sleep(3)
        status = run(ssh, f"{PATH_EXPORT}; pm2 jlist 2>/dev/null | python3 -c \"import sys,json; d=json.load(sys.stdin); print(next((p['pm2_env']['status'] for p in d if p['name']=='{app}'),'NF'))\"", timeout=30).strip()
        results.append((app, "RESTARTED", status))

    print("\n=== SUMMARY ===")
    for app, st, status in results:
        print(f"{app}: {st} pm2={status}")

    # Health check all ports.
    print("\n=== HEALTH ===")
    ports = {"ykp-hr-v1": 3008, "ykp-finance-v1": 3009, "ykp-investor-v1": 3006,
             "ykp-ops-v1": 3007, "ykp-warehouse-v1": 3005}
    for app, port in ports.items():
        # 200 or 401 both mean app is up; 502/000 = down.
        h = run(ssh, f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{port}/ 2>&1").strip()
        print(f"{app} (:{port}) -> HTTP {h}")
    ssh.close()


if __name__ == "__main__":
    main()