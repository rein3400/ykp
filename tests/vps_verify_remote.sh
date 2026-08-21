#!/bin/bash
# VPS P1/P2 deploy verification — runs ON the VPS.
export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin
echo "=== VPS P1/P2 deploy verification ==="

echo "[OK] warehouse alert-dedupe.ts present: $(test -f /home/dev/ykp/ykp-warehouse-v1/src/lib/alert-dedupe.ts && echo yes || echo NO)"
echo "[OK] finance concurrency.ts present: $(test -f /home/dev/ykp/ykp-finance-v1/src/lib/concurrency.ts && echo yes || echo NO)"
echo "[OK] warehouse .next/BUILD_ID present: $(test -f /home/dev/ykp/ykp-warehouse-v1/.next/BUILD_ID && echo yes || echo NO)"
echo "[OK] finance .next/BUILD_ID present: $(test -f /home/dev/ykp/ykp-finance-v1/.next/BUILD_ID && echo yes || echo NO)"

RCV=$(grep -c 'upsertBatchStockOnReceipt\|findOpenAlert' /home/dev/ykp/ykp-warehouse-v1/src/app/api/warehouse/receiving/route.ts)
echo "[OK] receiving imports upsert+dedupe count=$RCV (want >=2): $(test "$RCV" -ge 2 && echo yes || echo NO)"
BS=$(grep -c 'findOpenAlert' /home/dev/ykp/ykp-warehouse-v1/src/app/api/warehouse/batch-stock/route.ts)
echo "[OK] batch-stock imports dedupe count=$BS (want >=1): $(test "$BS" -ge 1 && echo yes || echo NO)"
EX=$(grep -c 'guardedUpdateRow\|ConcurrentUpdateError' /home/dev/ykp/ykp-finance-v1/src/app/api/finance/expenses/[id]/approve/route.ts)
echo "[OK] expense approve imports guard count=$EX (want >=2): $(test "$EX" -ge 2 && echo yes || echo NO)"
PC=$(grep -c 'guardedUpdateRow\|ConcurrentUpdateError' /home/dev/ykp/ykp-finance-v1/src/app/api/finance/petty-cash/[id]/approve/route.ts)
echo "[OK] petty-cash approve imports guard count=$PC (want >=2): $(test "$PC" -ge 2 && echo yes || echo NO)"
AP=$(grep -c 'segregation of duties' /home/dev/ykp/ykp-finance-v1/src/lib/approval.ts)
echo "[OK] approval.ts self-approve guard count=$AP (want >=1): $(test "$AP" -ge 1 && echo yes || echo NO)"

WH_LOGIN=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3005/login)
FI_LOGIN=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3009/login)
WH_AUDIT=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3005/api/warehouse/audit)
FI_AUDIT=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3009/api/finance/audit)
echo "[HTTP] warehouse /login -> $WH_LOGIN (want 200)"
echo "[HTTP] finance /login -> $FI_LOGIN (want 200)"
echo "[HTTP] warehouse /api/warehouse/audit -> $WH_AUDIT (want 200)"
echo "[HTTP] finance /api/finance/audit -> $FI_AUDIT (want 200)"

WH_STATUS=$(pm2 jlist 2>/dev/null | grep -o '"name":"ykp-warehouse"[^}]*"status":"online"' | wc -l)
FI_STATUS=$(pm2 jlist 2>/dev/null | grep -o '"name":"ykp-finance-v1"[^}]*"status":"online"' | wc -l)
echo "[PM2] ykp-warehouse online: $(test "$WH_STATUS" -ge 1 && echo yes || echo NO)"
echo "[PM2] ykp-finance-v1 online: $(test "$FI_STATUS" -ge 1 && echo yes || echo NO)"
echo "=== END ==="