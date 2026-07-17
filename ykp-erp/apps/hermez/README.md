# YKP Hermez

Next.js 14 app router, dark theme, port 3004.

## No-write-back guard

Hermez is read-mostly. It may only:

- **Read** `hr_daily_summary`, `fin_daily_summary`, `master_brand`, `master_outlet`, `master_supplier`, `master_employee`.
- **Write** `hermez_daily_brief`, `hermez_alert_log`, `hermez_config`, `hermez_audit_log`.

CI check:

```bash
grep -rn "hr_attendance\|hr_payroll\|fin_pos_daily\|fin_supplier_cost\|fin_petty_cash\|fin_expense\|fin_closing_cash" \
  apps/hermez/src/app/api/ \
  apps/hermez/src/features/ \
  apps/hermez/src/lib/ \
  | grep -v "hr_daily_summary\|fin_daily_summary\|master_brand\|master_outlet\|master_supplier\|master_employee" \
  | grep -v "\.select("
# Must return zero matches.
```

## Env vars

```bash
# Required
YKP_MASTER_DATABASE_URL=
YKP_HR_DATABASE_URL=
YKP_FINANCE_DATABASE_URL=
YKP_HERMEZ_DATABASE_URL=

# Optional (cron / telegram)
HERMEZ_CRON_SECRET=
HERMEZ_TELEGRAM_BOT_TOKEN=   # or TELEGRAM_BOT_TOKEN
OWNER_CHAT_ID=               # group chat id (negative), e.g. -5437367893
TELEGRAM_OWNER_CHAT_ID=      # alias for OWNER_CHAT_ID
REDIS_URL=
```
