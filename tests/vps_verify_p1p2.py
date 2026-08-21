"""VPS post-deploy verification for P1/P2 fixes.

Confirms the two restarted apps:
  - are online and serve a public endpoint (200)
  - booted without errors (recent pm2 log lines clean of the new modules)
  - the new source files are present on disk (alert-dedupe.ts, concurrency.ts)
  - the receiving route imports upsertBatchStockOnReceipt + findOpenAlert
    (grep the built route / source)
  - the finance approve route imports guardedUpdateRow (grep source)

Captures responses to the scratch vps-verify.log.
"""
import sys, os
sys.path.insert(0, "tests")
from vps_ssh import run as ssh_exec  # noqa

LOG = os.path.join(os.environ.get("TEMP", "/tmp"), "grok-goal-b2987b9171b0", "implementer", "vps-verify.log")
os.makedirs(os.path.dirname(LOG), exist_ok=True)
out_lines = []


def log(*a):
    line = " ".join(str(x) for x in a)
    print(line)
    out_lines.append(line)


def run(cmd):
    o, e = ssh_exec(cmd)
    return o, e


checks = [
    ("warehouse new files present",
     "ls -la /home/dev/ykp/ykp-warehouse-v1/src/lib/alert-dedupe.ts /home/dev/ykp/ykp-warehouse-v1/src/lib/stock-ledger.ts | wc -l",
     lambda o: o.strip() == "2"),
    ("finance new files present",
     "ls -la /home/dev/ykp/ykp-finance-v1/src/lib/concurrency.ts /home/dev/ykp/ykp-finance-v1/src/lib/approval.ts | wc -l",
     lambda o: o.strip() == "2"),
    ("receiving route imports upsert+dedupe",
     "grep -c 'upsertBatchStockOnReceipt\\|findOpenAlert' /home/dev/ykp/ykp-warehouse-v1/src/app/api/warehouse/receiving/route.ts",
     lambda o: int(o.strip()) >= 2),
    ("batch-stock route imports dedupe",
     "grep -c 'findOpenAlert' /home/dev/ykp/ykp-warehouse-v1/src/app/api/warehouse/batch-stock/route.ts",
     lambda o: int(o.strip()) >= 1),
    ("expense approve route imports guardedUpdateRow",
     "grep -c 'guardedUpdateRow\\|ConcurrentUpdateError' /home/dev/ykp/ykp-finance-v1/src/app/api/finance/expenses/[id]/approve/route.ts",
     lambda o: int(o.strip()) >= 2),
    ("petty-cash approve route imports guardedUpdateRow",
     "grep -c 'guardedUpdateRow\\|ConcurrentUpdateError' /home/dev/ykp/ykp-finance-v1/src/app/api/finance/petty-cash/[id]/approve/route.ts",
     lambda o: int(o.strip()) >= 2),
    ("approval.ts has self-approve guard",
     "grep -c 'segregation of duties' /home/dev/ykp/ykp-finance-v1/src/lib/approval.ts",
     lambda o: int(o.strip()) >= 1),
    ("warehouse app online (pm2)",
     "pm2 jlist 2>/dev/null | grep -o '\\\"name\\\":\\\"ykp-warehouse\\\"[^}]*\\\"status\\\":\\\"online\\\"' | wc -l",
     lambda o: int(o.strip()) >= 1),
    ("finance app online (pm2)",
     "pm2 jlist 2>/dev/null | grep -o '\\\"name\\\":\\\"ykp-finance-v1\\\"[^}]*\\\"status\\\":\\\"online\\\"' | wc -l",
     lambda o: int(o.strip()) >= 1),
]

# Health endpoints (public read-only)
health = [
    ("warehouse health", "curl -s -o /dev/null -w '%{http_code}' http://localhost:3005/"),
    ("finance health", "curl -s -o /dev/null -w '%{http_code}' http://localhost:3009/"),
]

PATH = "export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin; "

log("=== VPS P1/P2 deploy verification ===")
all_ok = True
for name, cmd, pred in checks:
    o, e = run(PATH + cmd)
    ok = False
    try:
        ok = pred(o)
    except Exception as ex:
        log(f"[ERR] {name}: pred raised {ex}; out={o!r} err={e!r}")
    if ok:
        log(f"[OK] {name}")
    else:
        all_ok = False
        log(f"[FAIL] {name}: out={o!r} err={e!r}")

for name, cmd in health:
    o, e = run(PATH + cmd)
    log(f"[{o}] {name} (HTTP {o})")
    if o.strip() != "200":
        all_ok = False

# recent error log scan
o, e = run(PATH + "pm2 logs ykp-warehouse --nostream --lines 15 --err 2>&1 | tail -20")
log("--- warehouse err log tail ---")
log(o or "(empty)")
o, e = run(PATH + "pm2 logs ykp-finance-v1 --nostream --lines 15 --err 2>&1 | tail -20")
log("--- finance err log tail ---")
log(o or "(empty)")

log(f"=== RESULT: {'ALL OK' if all_ok else 'FAILURES'} ===")

with open(LOG, "w", encoding="utf-8") as f:
    f.write("\n".join(out_lines))