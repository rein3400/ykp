#!/usr/bin/env bash
#
# deploy.sh — provision + deploy the full YKP V1 family onto a Coolify server.
#
# Recreates the exact state reached on the reference VPS: project "YKP", 7
# Next.js apps (hub, owner, hr, finance, warehouse, investor, ops) served over
# HTTPS sslip.io domains, live Google Sheets wiring, Telegram notify, Moka sync,
# and 8 Coolify scheduled cron tasks.
#
# Requirements: bash, curl, jq, openssl, and a Coolify API root token.
#
# Usage:
#   cp .deploy.env.example .deploy.env
#   $EDITOR .deploy.env          # fill in every value
#   ./deploy.sh                  # idempotent: safe to re-run
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${1:-$HERE/.deploy.env}"
[[ -f "$ENV_FILE" ]] || { echo "error: $ENV_FILE not found (see .deploy.env.example)"; exit 1; }
set -a; source "$ENV_FILE"; set +a

: "${COOLIFY_URL:?set COOLIFY_URL}"; : "${COOLIFY_TOKEN:?set COOLIFY_TOKEN}"; : "${VPS_IP:?set VPS_IP}"
GIT_REPO="${GIT_REPO:-https://github.com/rein3400/ykp.git}"; GIT_BRANCH="${GIT_BRANCH:-main}"

COOLIFY_URL="${COOLIFY_URL%/}"; API="$COOLIFY_URL/api/v1"
AUTH=(-H "Authorization: Bearer $COOLIFY_TOKEN" -H "Content-Type: application/json" -H "Accept: application/json")
IPDOTS="$(printf '%s' "$VPS_IP" | tr '-' '.')"
gen() { openssl rand -hex 32; }

# secrets with auto-generation fallback
HUB_SESSION_SECRET="${HUB_SESSION_SECRET:-$(gen)}"
SESSION_HUB="${SESSION_HUB:-$(gen)}"
SESSION_OWNER="${SESSION_OWNER:-$(gen)}";  SESSION_HR="${SESSION_HR:-$(gen)}"
SESSION_FINANCE="${SESSION_FINANCE:-$(gen)}"; SESSION_WAREHOUSE="${SESSION_WAREHOUSE:-$(gen)}"
SESSION_INVESTOR="${SESSION_INVESTOR:-$(gen)}"; SESSION_OPS="${SESSION_OPS:-$(gen)}"
CRON_HR="${CRON_HR:-$(gen)}"; CRON_FINANCE="${CRON_FINANCE:-$(gen)}"
CRON_WAREHOUSE="${CRON_WAREHOUSE:-$(gen)}"; CRON_INVESTOR="${CRON_INVESTOR:-$(gen)}"
ERP_SSO_SECRET="${ERP_SSO_SECRET:-$(gen)}"

say() { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }
api() { curl -fsS -X "${1}" "$API${2}" "${AUTH[@]}" ${3:+-d "$3"}; }

# ---------------------------------------------------------------------------
say "Project"
PROJ_UUID="$(api GET /projects | jq -r --arg n YKP 'map(select(.name==$n))[0].uuid // empty')"
[[ -z "$PROJ_UUID" ]] && PROJ_UUID="$(api POST /projects '{"name":"YKP","description":"YKP V1 (Google Sheets apps)"}' | jq -r .uuid)"
ENV_UUID="$(api GET "/projects/$PROJ_UUID" | jq -r '.environments[]|select(.name=="production").uuid')"
SERVER_UUID="$(api GET /servers | jq -r '.[0].uuid')"
echo "project=$PROJ_UUID  env=$ENV_UUID  server=$SERVER_UUID"

# ---------------------------------------------------------------------------
# name dir port
declare -A DIR PORT
DIR[ykp-hub]=ykp-hub;                 PORT[ykp-hub]=3000
DIR[ykp-owner-v1]=ykp-owner-v1;       PORT[ykp-owner-v1]=3010
DIR[ykp-hr-v1]=ykp-hr-v1;             PORT[ykp-hr-v1]=3002
DIR[ykp-finance-v1]=ykp-finance-v1;   PORT[ykp-finance-v1]=3003
DIR[ykp-warehouse-v1]=ykp-warehouse-v1; PORT[ykp-warehouse-v1]=3005
DIR[ykp-investor-v1]=ykp-investor-v1; PORT[ykp-investor-v1]=3006
DIR[ykp-ops-v1]=ykp-ops-v1;           PORT[ykp-ops-v1]=3007
APPS="ykp-hub ykp-owner-v1 ykp-hr-v1 ykp-finance-v1 ykp-warehouse-v1 ykp-investor-v1 ykp-ops-v1"

declare -A UUID
for a in $APPS; do
  say "App: $a"
  u="$(api POST /applications/public "$(jq -n \
      --arg pu "$PROJ_UUID" --arg su "$SERVER_UUID" --arg en "$ENV_UUID" \
      --arg gr "$GIT_REPO" --arg gb "$GIT_BRANCH" --arg name "$a" \
      --arg dir "/${DIR[$a]}" --arg port "${PORT[$a]}" \
      '{project_uuid:$pu,server_uuid:$su,environment_uuid:$en,git_repository:$gr,git_branch:$gb,
        build_pack:"dockerfile",dockerfile_location:"/Dockerfile",base_directory:$dir,
        ports_exposes:$port,ports_mappings:($port+":"+$port),name:$name,is_force_https_enabled:false,
        instant_deploy:false}')" | jq -r .uuid)"
  # stable docker-network hostname (hub reaches modules container-to-container)
  api PATCH "/applications/$u" "$(jq -n --arg n "$a" '{custom_network_aliases:$n,is_consistent_container_name_enabled:true,custom_internal_name:$n}')" >/dev/null
  # https scheme -> Traefik emits an https router + Let's Encrypt cert (http:// gives http-only, no TLS)
  api PATCH "/applications/$u" "$(jq -n --arg d "https://$u.$IPDOTS.sslip.io" '{domains:$d}')" >/dev/null
  UUID[$a]="$u"; echo "  uuid=$u"
done

U() { echo "https://${UUID[$1]}.$IPDOTS.sslip.io"; }
I() { echo "http://$1:${PORT[$1]}"; }
URL_HUB="$(U ykp-hub)"; URL_OWNER="$(U ykp-owner-v1)"; URL_HR="$(U ykp-hr-v1)"
URL_FINANCE="$(U ykp-finance-v1)"; URL_WAREHOUSE="$(U ykp-warehouse-v1)"
URL_INVESTOR="$(U ykp-investor-v1)"; URL_OPS="$(U ykp-ops-v1)"
# hub is reachable both via its HTTPS domain and via http://<ip>:3000
HUB_IP_ORIGIN="http://$VPS_IP:3000"

set_env() { api PATCH "/applications/$1/envs/bulk" "$2" >/dev/null; }

# ---------------------------------------------------------------------------
say "Env: ykp-hub"
set_env "${UUID[ykp-hub]}" "$(jq -n \
  --arg o "$URL_OWNER" --arg h "$URL_HR" --arg f "$URL_FINANCE" --arg w "$URL_WAREHOUSE" \
  --arg i "$URL_INVESTOR" --arg p "$URL_OPS" --arg app "$URL_HUB" --arg sso "$ERP_SSO_SECRET" \
  --arg hs "$HUB_SESSION_SECRET" --arg ss "$SESSION_HUB" \
  --arg io "$(I ykp-owner-v1)" --arg ih "$(I ykp-hr-v1)" --arg iff "$(I ykp-finance-v1)" \
  --arg iw "$(I ykp-warehouse-v1)" --arg ii "$(I ykp-investor-v1)" --arg ip "$(I ykp-ops-v1)" \
  '[
    {key:"NEXT_PUBLIC_YKP_OWNER_URL",value:$o,is_runtime:true,is_buildtime:true,is_literal:true},
    {key:"NEXT_PUBLIC_YKP_HR_URL",value:$h,is_runtime:true,is_buildtime:true,is_literal:true},
    {key:"NEXT_PUBLIC_YKP_FINANCE_URL",value:$f,is_runtime:true,is_buildtime:true,is_literal:true},
    {key:"NEXT_PUBLIC_YKP_WAREHOUSE_URL",value:$w,is_runtime:true,is_buildtime:true,is_literal:true},
    {key:"NEXT_PUBLIC_YKP_INVESTOR_URL",value:$i,is_runtime:true,is_buildtime:true,is_literal:true},
    {key:"NEXT_PUBLIC_YKP_OPS_URL",value:$p,is_runtime:true,is_buildtime:true,is_literal:true},
    {key:"NEXT_PUBLIC_APP_URL",value:$app,is_runtime:true,is_buildtime:true,is_literal:true},
    {key:"NEXT_PUBLIC_ERP_SSO_SECRET",value:$sso,is_runtime:true,is_buildtime:true,is_literal:true},
    {key:"ERP_SSO_SECRET",value:$sso,is_runtime:true,is_buildtime:false,is_literal:true},
    {key:"HUB_SESSION_SECRET",value:$hs,is_runtime:true},
    {key:"SESSION_SECRET",value:$ss,is_runtime:true},
    {key:"YKP_OWNER_INTERNAL_URL",value:$io,is_runtime:true,is_literal:true},
    {key:"YKP_HR_INTERNAL_URL",value:$ih,is_runtime:true,is_literal:true},
    {key:"YKP_FINANCE_INTERNAL_URL",value:$iff,is_runtime:true,is_literal:true},
    {key:"YKP_WAREHOUSE_INTERNAL_URL",value:$iw,is_runtime:true,is_literal:true},
    {key:"YKP_INVESTOR_INTERNAL_URL",value:$ii,is_runtime:true,is_literal:true},
    {key:"YKP_OPS_INTERNAL_URL",value:$ip,is_runtime:true,is_literal:true},
    {key:"PORT",value:"3000",is_runtime:true}
  ]')"

say "Env: ykp-owner-v1"
set_env "${UUID[ykp-owner-v1]}" "$(jq -n \
  --arg h "$URL_HR" --arg f "$URL_FINANCE" --arg w "$URL_WAREHOUSE" --arg o "$URL_OPS" --arg i "$URL_INVESTOR" \
  --arg s "$SESSION_OWNER" --arg t "$TELEGRAM_BOT_SECRET" \
  '[{key:"YKP_HR_URL",value:$h},{key:"YKP_FINANCE_URL",value:$f},{key:"YKP_WAREHOUSE_URL",value:$w},
    {key:"YKP_OPS_URL",value:$o},{key:"YKP_INVESTOR_URL",value:$i},{key:"SESSION_SECRET",value:$s},
    {key:"TELEGRAM_BOT_SECRET",value:$t},{key:"YKP_OWNER_MOCK",value:"false"},{key:"PORT",value:"3010"}]' \
  | jq 'map(.is_runtime=true)')"

say "Env: ykp-hr-v1"
set_env "${UUID[ykp-hr-v1]}" "$(jq -n \
  --arg hub "$URL_HUB $HUB_IP_ORIGIN" --arg tg "$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME" --arg s "$SESSION_HR" --arg c "$CRON_HR" \
  --arg t "$TELEGRAM_BOT_TOKEN" --arg chat "$TELEGRAM_CHAT_ID" --arg wh "$TELEGRAM_WEBHOOK_SECRET" --arg ts "$TELEGRAM_BOT_SECRET" \
  --arg gsa "$GOOGLE_SERVICE_ACCOUNT_EMAIL" --arg gsk "$GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY" --arg sid "$YKP_HR_SPREADSHEET_ID" \
  '[{key:"NEXT_PUBLIC_TELEGRAM_BOT_USERNAME",value:$tg,is_runtime:true,is_buildtime:true},
    {key:"YKP_HUB_ORIGIN",value:$hub,is_runtime:true,is_buildtime:true,is_literal:true},
    {key:"SESSION_SECRET",value:$s},{key:"CRON_SECRET",value:$c},{key:"TELEGRAM_BOT_TOKEN",value:$t},
    {key:"TELEGRAM_CHAT_ID",value:$chat},{key:"TELEGRAM_WEBHOOK_SECRET",value:$wh},{key:"TELEGRAM_BOT_SECRET",value:$ts},
    {key:"GOOGLE_SERVICE_ACCOUNT_EMAIL",value:$gsa},{key:"GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",value:$gsk,is_literal:true},
    {key:"YKP_HR_SPREADSHEET_ID",value:$sid},{key:"TZ",value:"Asia/Jakarta"},{key:"PORT",value:"3002"}]' \
  | jq 'map(.is_runtime=true)')"

say "Env: ykp-finance-v1"
set_env "${UUID[ykp-finance-v1]}" "$(jq -n \
  --arg tg "$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME" --arg s "$SESSION_FINANCE" --arg c "$CRON_FINANCE" \
  --arg t "$TELEGRAM_BOT_TOKEN" --arg chat "$TELEGRAM_CHAT_ID" --arg ts "$TELEGRAM_BOT_SECRET" \
  --arg gsa "$GOOGLE_SERVICE_ACCOUNT_EMAIL" --arg gsk "$GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY" --arg sid "$YKP_FINANCE_SPREADSHEET_ID" \
  --arg ms "$MOKA_SYNC_SECRET" --arg mo "$MOKA_OUTLETS" --arg mm "$MOKA_OUTLET_MAP" \
  --arg s1 "$MOKA_SEKARPIZZA_TIRTODIPURAN_CLIENT_ID" --arg s2 "$MOKA_SEKARPIZZA_TIRTODIPURAN_CLIENT_SECRET" --arg s3 "$MOKA_SEKARPIZZA_TIRTODIPURAN_OUTLET_ID" \
  --arg f1 "$MOKA_FUNKYDAK_COLOMBO_CLIENT_ID" --arg f2 "$MOKA_FUNKYDAK_COLOMBO_CLIENT_SECRET" --arg f3 "$MOKA_FUNKYDAK_COLOMBO_OUTLET_ID" \
  --arg u1 "$MOKA_SUBURBUNS_COLOMBO_CLIENT_ID" --arg u2 "$MOKA_SUBURBUNS_COLOMBO_CLIENT_SECRET" --arg u3 "$MOKA_SUBURBUNS_COLOMBO_OUTLET_ID" \
  '[{key:"NEXT_PUBLIC_TELEGRAM_BOT_USERNAME",value:$tg,is_runtime:true,is_buildtime:true},
    {key:"SESSION_SECRET",value:$s},{key:"CRON_SECRET",value:$c},{key:"ENVIRONMENT",value:"PRODUCTION"},
    {key:"TELEGRAM_BOT_TOKEN",value:$t},{key:"TELEGRAM_CHAT_ID",value:$chat},{key:"TELEGRAM_BOT_SECRET",value:$ts},
    {key:"GOOGLE_SERVICE_ACCOUNT_EMAIL",value:$gsa},{key:"GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",value:$gsk,is_literal:true},
    {key:"YKP_FINANCE_SPREADSHEET_ID",value:$sid},{key:"MOKA_SYNC_ENABLED",value:"true"},
    {key:"MOKA_SYNC_SECRET",value:$ms},{key:"MOKA_OUTLETS",value:$mo},{key:"MOKA_OUTLET_MAP",value:$mm,is_literal:true},
    {key:"MOKA_SEKARPIZZA_TIRTODIPURAN_CLIENT_ID",value:$s1},{key:"MOKA_SEKARPIZZA_TIRTODIPURAN_CLIENT_SECRET",value:$s2},
    {key:"MOKA_SEKARPIZZA_TIRTODIPURAN_OUTLET_ID",value:$s3},{key:"MOKA_FUNKYDAK_COLOMBO_CLIENT_ID",value:$f1},
    {key:"MOKA_FUNKYDAK_COLOMBO_CLIENT_SECRET",value:$f2},{key:"MOKA_FUNKYDAK_COLOMBO_OUTLET_ID",value:$f3},
    {key:"MOKA_SUBURBUNS_COLOMBO_CLIENT_ID",value:$u1},{key:"MOKA_SUBURBUNS_COLOMBO_CLIENT_SECRET",value:$u2},
    {key:"MOKA_SUBURBUNS_COLOMBO_OUTLET_ID",value:$u3},{key:"USE_MOCK_DB",value:"false"},{key:"PORT",value:"3003"}]' \
  | jq 'map(.is_runtime=true)')"

say "Env: ykp-warehouse-v1"
set_env "${UUID[ykp-warehouse-v1]}" "$(jq -n \
  --arg hub "$URL_HUB $HUB_IP_ORIGIN" --arg tg "$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME" --arg s "$SESSION_WAREHOUSE" --arg c "$CRON_WAREHOUSE" \
  --arg t "$TELEGRAM_BOT_TOKEN" --arg chat "$TELEGRAM_CHAT_ID" --arg ts "$TELEGRAM_BOT_SECRET" \
  --arg gsa "$GOOGLE_SERVICE_ACCOUNT_EMAIL" --arg gsk "$GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY" --arg sid "$YKP_WAREHOUSE_SPREADSHEET_ID" \
  --arg fin "$URL_FINANCE" \
  '[{key:"NEXT_PUBLIC_TELEGRAM_BOT_USERNAME",value:$tg,is_runtime:true,is_buildtime:true},
    {key:"YKP_HUB_ORIGIN",value:$hub,is_runtime:true,is_buildtime:true,is_literal:true},
    {key:"SESSION_SECRET",value:$s},{key:"CRON_SECRET",value:$c},{key:"TELEGRAM_BOT_TOKEN",value:$t},
    {key:"TELEGRAM_CHAT_ID",value:$chat},{key:"TELEGRAM_BOT_SECRET",value:$ts},{key:"ENVIRONMENT",value:"PRODUCTION"},
    {key:"YKP_FINANCE_URL",value:$fin},{key:"GOOGLE_SERVICE_ACCOUNT_EMAIL",value:$gsa},
    {key:"GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",value:$gsk,is_literal:true},{key:"YKP_WAREHOUSE_SPREADSHEET_ID",value:$sid},{key:"PORT",value:"3005"}]' \
  | jq 'map(.is_runtime=true)')"

say "Env: ykp-investor-v1"
set_env "${UUID[ykp-investor-v1]}" "$(jq -n \
  --arg hub "$URL_HUB $HUB_IP_ORIGIN" --arg fin "$URL_FINANCE" --arg tg "$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME" --arg s "$SESSION_INVESTOR" --arg c "$CRON_INVESTOR" \
  --arg sso "$ERP_SSO_SECRET" --arg t "$TELEGRAM_BOT_TOKEN" --arg chat "$TELEGRAM_CHAT_ID" --arg ts "$TELEGRAM_BOT_SECRET" \
  --arg gsa "$GOOGLE_SERVICE_ACCOUNT_EMAIL" --arg gsk "$GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY" --arg sid "$YKP_INVESTOR_SPREADSHEET_ID" \
  '[{key:"NEXT_PUBLIC_TELEGRAM_BOT_USERNAME",value:$tg,is_runtime:true,is_buildtime:true},
    {key:"NEXT_PUBLIC_FINANCE_URL",value:$fin,is_runtime:true,is_buildtime:true,is_literal:true},
    {key:"YKP_HUB_ORIGIN",value:$hub,is_runtime:true,is_buildtime:true,is_literal:true},
    {key:"SESSION_SECRET",value:$s},{key:"FINANCE_URL",value:$fin},{key:"ERP_SSO_SECRET",value:$sso},{key:"CRON_SECRET",value:$c},
    {key:"TELEGRAM_BOT_TOKEN",value:$t},{key:"TELEGRAM_CHAT_ID",value:$chat},{key:"TELEGRAM_BOT_SECRET",value:$ts},
    {key:"GOOGLE_SERVICE_ACCOUNT_EMAIL",value:$gsa},{key:"GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",value:$gsk,is_literal:true},
    {key:"YKP_INVESTOR_SPREADSHEET_ID",value:$sid},{key:"PORT",value:"3006"}]' \
  | jq 'map(.is_runtime=true)')"

say "Env: ykp-ops-v1"
set_env "${UUID[ykp-ops-v1]}" "$(jq -n \
  --arg hub "$URL_HUB,$HUB_IP_ORIGIN" --arg tg "$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME" --arg s "$SESSION_OPS" \
  --arg t "$TELEGRAM_BOT_TOKEN" --arg chat "$TELEGRAM_CHAT_ID" --arg ts "$TELEGRAM_BOT_SECRET" \
  --arg gsa "$GOOGLE_SERVICE_ACCOUNT_EMAIL" --arg gsk "$GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY" --arg sid "$YKP_OPS_SPREADSHEET_ID" \
  --arg oai "${OPENAI_API_KEY:-}" --arg model "${AI_MODEL:-openai/gpt-4o-mini}" \
  --arg base "${OPENAI_BASE_URL:-https://openrouter.ai/api/v1}" \
  --arg ref "${OPENAI_HTTP_REFERER:-}" --arg title "${OPENAI_APP_TITLE:-}" \
  '[{key:"NEXT_PUBLIC_TELEGRAM_BOT_USERNAME",value:$tg,is_runtime:true,is_buildtime:true},
    {key:"SESSION_SECRET",value:$s},{key:"HUB_ORIGINS",value:$hub,is_literal:true},
    {key:"TELEGRAM_BOT_TOKEN",value:$t},{key:"TELEGRAM_CHAT_ID",value:$chat},{key:"TELEGRAM_BOT_SECRET",value:$ts},
    {key:"AI_MODEL",value:$model},{key:"OPENAI_API_KEY",value:$oai},
    {key:"OPENAI_BASE_URL",value:$base},{key:"OPENAI_HTTP_REFERER",value:$ref},
    {key:"OPENAI_APP_TITLE",value:$title},
    {key:"GOOGLE_SERVICE_ACCOUNT_EMAIL",value:$gsa},{key:"GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",value:$gsk,is_literal:true},
    {key:"YKP_OPS_SPREADSHEET_ID",value:$sid},{key:"PORT",value:"3007"}]' \
  | jq 'map(.is_runtime=true)')"

# ---------------------------------------------------------------------------
say "Deploy (first build)"
for a in ykp-hr-v1 ykp-finance-v1 ykp-warehouse-v1 ykp-investor-v1 ykp-ops-v1 ykp-owner-v1 ykp-hub; do
  api POST "/deploy?uuid=${UUID[$a]}&force=false" >/dev/null && echo "  queued $a"
done

say "Waiting for builds…"
for a in $APPS; do
  for _ in $(seq 1 120); do
    s="$(api GET "/deployments/applications/${UUID[$a]}" | jq -r '.deployments[0].status // empty')"
    [[ "$s" =~ ^(finished|failed)$ ]] && break; sleep 15
  done
  echo "  $a -> ${s:-unknown}"
done

# ---------------------------------------------------------------------------
say "Scheduled tasks (cron)"
# command kept short: Coolify stores it in a ~255-char column, so read the secret
# from the container env instead of embedding it.
task() { # app name freq port path header envvar
  local app="$1" name="$2" freq="$3" port="$4" path="$5" header="$6" envvar="$7"
  api POST "/applications/${UUID[$app]}/scheduled-tasks" "$(jq -n \
    --arg n "$name" --arg f "$freq" --arg app "$app" \
    --arg c "node -e 'fetch(\"http://localhost:$port$path\",{method:\"POST\",headers:{\"$header\":process.env.$envvar}}).then(r=>r.text()).then(t=>console.log(t.slice(0,200)))'" \
    '{name:$n,frequency:$f,enabled:true,timeout:120,container:$app,command:$c}')" >/dev/null
  echo "  $app/$name ($freq)"
}
task ykp-hr-v1        daily-brief        "0 15 * * *" 3002 /api/hr/notify/daily-brief              x-cron-secret      CRON_SECRET
task ykp-hr-v1        contract-reminders "0 1 * * *"  3002 /api/hr/notify/contract-reminders       x-cron-secret      CRON_SECRET
task ykp-finance-v1   daily-brief        "0 15 * * *" 3003 /api/finance/notify/daily-brief         x-cron-secret      CRON_SECRET
task ykp-finance-v1   moka-pos-sync      "0 16 * * *" 3003 /api/finance/pos/sync                   x-moka-sync-secret MOKA_SYNC_SECRET
task ykp-warehouse-v1 daily-brief        "0 15 * * *" 3005 /api/warehouse/notify/daily-brief      x-cron-secret      CRON_SECRET
task ykp-warehouse-v1 random-audit       "0 1 * * 1"  3005 /api/warehouse/cron/random-audit        x-cron-secret      CRON_SECRET
task ykp-warehouse-v1 verify-audit-chain "30 16 * * *" 3005 /api/warehouse/cron/verify-audit-chain x-cron-secret      CRON_SECRET
task ykp-investor-v1  daily-brief        "0 15 * * *" 3006 /api/investor/notify/daily-brief        x-cron-secret      CRON_SECRET

# second Moka pass at 18:00 UTC (01:00 WIB) pulls YESTERDAY, catching sales posted after
# the 23:00 WIB close. Date is computed in-command (no prelude - Coolify 500s on that shape).
YCMD="node -e 'fetch(\"http://localhost:3003/api/finance/pos/sync\",{method:\"POST\",headers:{\"x-moka-sync-secret\":process.env.MOKA_SYNC_SECRET},body:JSON.stringify({date:new Date(Date.now()-612e5).toJSON().slice(0,10)})}).then(r=>r.text()).then(console.log)'"
api POST "/applications/${UUID[ykp-finance-v1]}/scheduled-tasks" "$(jq -n --arg c "$YCMD" \
  '{name:"moka-pos-sync-yesterday",frequency:"0 18 * * *",enabled:true,timeout:120,container:"ykp-finance-v1",command:$c}')" >/dev/null
echo "  ykp-finance-v1/moka-pos-sync-yesterday (0 18 * * *)"

# ---------------------------------------------------------------------------
say "Verify"
curl -fsS "$URL_HUB/api/health" | jq -c '{overall:.data.overall, modules:[.data.results[]|{id,reachable}]}'

cat <<EOF

Done. YKP V1 family on $COOLIFY_URL

  Hub       $URL_HUB
  Owner     $URL_OWNER
  HR        $URL_HR
  Finance   $URL_FINANCE
  Warehouse $URL_WAREHOUSE
  Investor  $URL_INVESTOR
  Ops       $URL_OPS

Login: owner / <password from the shared Sheets user store>

Manual follow-ups (once per target server):
  1. Moka outlet map — add the 3 outlet rows to master_outlet if missing; MOKA_OUTLET_MAP is
     already passed above and seeds app_settings on first sync.
  2. ops AI — set a real OPENAI_API_KEY (empty = AI disabled).
  3. Rotate the default owner password in the shared Sheets user store.
EOF
