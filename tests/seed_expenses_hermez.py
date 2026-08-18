import paramiko
import random
from datetime import datetime, timedelta

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

def run_pg_batch(sqls):
    joined = "\n".join(sqls)
    sftp = ssh.open_sftp()
    with sftp.file('/tmp/seed_expenses_hermez.sql', 'w') as f:
        f.write(joined)
    sftp.close()
    cmd = "echo password | sudo -S docker cp /tmp/seed_expenses_hermez.sql ykp-postgres:/tmp/seed_expenses_hermez.sql && echo password | sudo -S docker exec ykp-postgres psql -U ykp -d ykp_erp -f /tmp/seed_expenses_hermez.sql"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    return out, err

sqls = []

outlets = [
    ("OL-001", "BR-001", "Funkydak Cipete", "Funkydak"),
    ("OL-002", "BR-001", "Funkydak Kemang", "Funkydak"),
    ("OL-003", "BR-002", "Sekarpizza Demangan", "Sekarpizza"),
    ("OL-004", "BR-002", "Sekarpizza Seturan", "Sekarpizza"),
    ("OL-005", "BR-003", "Suburbuns Depok", "Suburbuns"),
    ("OL-006", "BR-004", "Laju Kopi Bintaro", "Laju Kopi"),
    ("OL-007", "BR-005", "Uncle Masala Tebet", "Uncle Masala"),
]

base_date = datetime(2026, 8, 16)
dates = [(base_date - timedelta(days=d)).strftime("%Y-%m-%d") for d in range(14)]

cats = [("CAT-BAHAN", "Bahan Baku"), ("CAT-PACK", "Packaging"), ("CAT-LISTRIK", "Listrik")]

# 1. fin_expense
for dt in dates:
    for oid, bid, oname, bname in outlets:
        for idx, (cid, cname) in enumerate(cats, start=1):
            exp_id = f"EXP-{dt}-{oid}-{idx:02d}"
            amount = random.randint(150000, 1200000)
            sqls.append(f"""INSERT INTO finance.fin_expense (expense_id, date, brand_id, brand_name, outlet_id, outlet_name, category_id, amount, payment_method_id, description, approval_status, recorded_by)
                           VALUES ('{exp_id}', '{dt}', '{bid}', '{bname}', '{oid}', '{oname}', '{cid}', {amount}, 'PM-TRANSFER', 'Biaya {cname} harian', 'APPROVED', 'Finance SPV')
                           ON CONFLICT (expense_id) DO UPDATE SET amount={amount};""")

# 2. hermez_alert_log
alerts = [
    ("ALR-001", "2026-08-16", "Funkydak", "Funkydak Cipete", "late_staff", "critical", "3 staf telat hadir > 30 menit di Funkydak Cipete", "hr", "open", "none"),
    ("ALR-002", "2026-08-16", "Suburbuns", "Suburbuns Depok", "cash_diff", "critical", "Selisih kas -Rp75.000 saat closing di Suburbuns Depok", "finance", "open", "none"),
    ("ALR-003", "2026-08-16", "Laju Kopi", "Laju Kopi Bintaro", "petty_cash_anomaly", "warning", "Petty cash pengeluaran mendekati batas harian di Laju Kopi Bintaro", "finance", "open", "none"),
    ("ALR-004", "2026-08-15", "Sekarpizza", "Sekarpizza Seturan", "supplier_overdue", "warning", "Invoice jatuh tempo supplier PT Dairy Prima di Sekarpizza Seturan", "finance", "ack", "sudah dikonfirmasi admin"),
    ("ALR-005", "2026-08-15", "Uncle Masala", "Uncle Masala Tebet", "high_expense", "warning", "Biaya operasional melampaui rata-rata 7 hari di Uncle Masala Tebet", "finance", "resolved", "diverifikasi finance"),
]

for aid, adate, br, outl, atype, asev, msg, src, ast, act in alerts:
    sqls.append(f"""INSERT INTO hermez.hermez_alert_log (alert_id, date, brand, outlet, alert_type, severity, message, source_app, status, action_taken)
                   VALUES ('{aid}', '{adate}', '{br}', '{outl}', '{atype}', '{asev}', '{msg}', '{src}', '{ast}', '{act}')
                   ON CONFLICT (alert_id) DO NOTHING;""")

# 3. hermez_daily_brief
for d_idx, dt in enumerate(dates[:7]):
    brief_id = f"HZBR-{dt}"
    brief_text = f"""Ringkasan Eksekutif Hermez AI ({dt}):
- Total Estimasi Revenue: Rp38.500.000 (7 Outlet Aktif)
- Total Estimasi Surplus: Rp18.200.000
- Kehadiran SDM: 33 Hadir / 2 Izin / 0 Alpa
- Status Kas: Selisih terkontrol (< Rp100rb)
- Alert: 2 alert aktif (Disiplin masuk Cipete & Kas Depok)"""
    sqls.append(f"""INSERT INTO hermez.hermez_daily_brief (brief_id, date, brief_text, alert_level, sent_to_owner)
                   VALUES ('{brief_id}', '{dt}', '{brief_text}', 'yellow', true)
                   ON CONFLICT (brief_id) DO NOTHING;""")

print(f"Total SQL statements to execute: {len(sqls)}")
out, err = run_pg_batch(sqls)
print("EXECUTION COMPLETED:")
print(out[-600:] if len(out) > 600 else out)
if err and "ERROR" in err:
    print("STDERR:\n", err[:1000])

ssh.close()
