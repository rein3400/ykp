import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('187.77.114.168', username='dev', password='password', timeout=30)

ddl = [
    # finance-linking-sync
    "ALTER TABLE finance.fin_expense ADD COLUMN IF NOT EXISTS source_module text;",
    "ALTER TABLE finance.fin_expense ADD COLUMN IF NOT EXISTS source_transaction_id text;",
    "ALTER TABLE finance.fin_expense ADD COLUMN IF NOT EXISTS payment_source text;",
    "ALTER TABLE finance.fin_expense ADD COLUMN IF NOT EXISTS linked_supplier_invoice_id text;",
    "ALTER TABLE finance.fin_expense ADD COLUMN IF NOT EXISTS linked_petty_cash_id text;",
    "ALTER TABLE finance.fin_expense ADD COLUMN IF NOT EXISTS linked_payment_id text;",
    "ALTER TABLE finance.fin_supplier_cost ADD COLUMN IF NOT EXISTS source_module text;",
    "ALTER TABLE finance.fin_supplier_cost ADD COLUMN IF NOT EXISTS source_transaction_id text;",
    "ALTER TABLE finance.fin_supplier_cost ADD COLUMN IF NOT EXISTS payment_source text;",
    "ALTER TABLE finance.fin_supplier_cost ADD COLUMN IF NOT EXISTS linked_expense_id text;",
    "ALTER TABLE finance.fin_supplier_cost ADD COLUMN IF NOT EXISTS linked_petty_cash_id text;",
    "ALTER TABLE finance.fin_supplier_cost ADD COLUMN IF NOT EXISTS linked_payment_id text;",
    "ALTER TABLE finance.fin_petty_cash ADD COLUMN IF NOT EXISTS source_module text;",
    "ALTER TABLE finance.fin_petty_cash ADD COLUMN IF NOT EXISTS source_transaction_id text;",
    "ALTER TABLE finance.fin_petty_cash ADD COLUMN IF NOT EXISTS payment_source text;",
    "ALTER TABLE finance.fin_petty_cash ADD COLUMN IF NOT EXISTS linked_expense_id text;",
    "ALTER TABLE finance.fin_petty_cash ADD COLUMN IF NOT EXISTS linked_supplier_invoice_id text;",
    "ALTER TABLE finance.fin_petty_cash ADD COLUMN IF NOT EXISTS linked_payment_id text;",
    # hermez-schema-sync
    "ALTER TABLE hermez.hermez_daily_brief ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'PRODUCTION';",
    "ALTER TABLE hermez.hermez_alert_log ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'PRODUCTION';",
    "ALTER TABLE hermez.hermez_config ADD COLUMN IF NOT EXISTS label text;",
    "ALTER TABLE hermez.hermez_config ADD COLUMN IF NOT EXISTS unit text;",
    "ALTER TABLE hermez.hermez_config ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'warning';",
    "ALTER TABLE hermez.hermez_config ADD COLUMN IF NOT EXISTS description text;",
    "ALTER TABLE hermez.hermez_config ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;",
    "CREATE TABLE IF NOT EXISTS hermez.hermez_telegram_log (log_id text PRIMARY KEY NOT NULL, message_id text, recipient text NOT NULL, channel text NOT NULL DEFAULT 'owner', status text NOT NULL, sent_at timestamp DEFAULT now() NOT NULL, error_message text, retry_count integer NOT NULL DEFAULT 0);",
    "DO $$ BEGIN CREATE TYPE hermez.hermez_action_priority AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;",
    "DO $$ BEGIN CREATE TYPE hermez.hermez_action_status AS ENUM ('OPEN','IN_PROGRESS','WAITING_APPROVAL','DONE','CANCELLED','OVERDUE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;",
    "CREATE TABLE IF NOT EXISTS hermez.hermez_action_tracker (action_id text PRIMARY KEY NOT NULL, source_alert_id text, title text NOT NULL, brand text, outlet text, assigned_to text, priority hermez.hermez_action_priority NOT NULL DEFAULT 'MEDIUM', due_date date, status hermez.hermez_action_status NOT NULL DEFAULT 'OPEN', action_taken text, created_at timestamp DEFAULT now() NOT NULL, completed_at timestamp);",
]

sql = "\n".join(ddl)
# Write SQL to a temp file on VPS and run via psql
sftp = c.open_sftp()
with sftp.open('/tmp/schema_sync.sql', 'w') as f:
    f.write(sql)
sftp.close()

cmd = 'docker exec -i ykp-postgres psql -U ykp -d ykp_erp < /tmp/schema_sync.sql 2>&1'
stdin, stdout, stderr = c.exec_command(cmd, timeout=60)
print(stdout.read().decode())
print(stderr.read().decode())
c.close()
