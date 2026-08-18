import paramiko
import random
from datetime import datetime, timedelta

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

def run_pg_batch(sqls):
    joined = "\n".join(sqls)
    # Write to a remote sql file to execute cleanly without quoting errors
    sftp = ssh.open_sftp()
    with sftp.file('/tmp/seed_data.sql', 'w') as f:
        f.write(joined)
    sftp.close()
    cmd = "echo password | sudo -S docker cp /tmp/seed_data.sql ykp-postgres:/tmp/seed_data.sql && echo password | sudo -S docker exec ykp-postgres psql -U ykp -d ykp_erp -f /tmp/seed_data.sql"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    return out, err

sqls = []

# Outlets info
outlets = [
    ("OL-001", "BR-001", "Funkydak Cipete", "Funkydak"),
    ("OL-002", "BR-001", "Funkydak Kemang", "Funkydak"),
    ("OL-003", "BR-002", "Sekarpizza Demangan", "Sekarpizza"),
    ("OL-004", "BR-002", "Sekarpizza Seturan", "Sekarpizza"),
    ("OL-005", "BR-003", "Suburbuns Depok", "Suburbuns"),
    ("OL-006", "BR-004", "Laju Kopi Bintaro", "Laju Kopi"),
    ("OL-007", "BR-005", "Uncle Masala Tebet", "Uncle Masala"),
]

# 35 employees (5 per outlet)
# Generate 14 days of data up to today (2026-08-16)
base_date = datetime(2026, 8, 16)
dates = [(base_date - timedelta(days=d)).strftime("%Y-%m-%d") for d in range(14)]

print("Generating 14 days of HR attendance, daily summaries, finance daily summaries, POS receipts, expenses, alerts, and daily briefs...")

# 1. HR Attendance & Daily Summaries
for dt in dates:
    for oid, bid, oname, bname in outlets:
        present_count = 0
        late_count = 0
        absent_count = 0
        
        # 5 employees per outlet
        outlet_emp_offset = (int(oid.split('-')[1]) - 1) * 5
        for e_idx in range(1, 6):
            emp_num = outlet_emp_offset + e_idx
            empid = f"EMP-{emp_num:05d}"
            att_id = f"ATT-{dt}-{empid}"
            
            # Chance of late / absent
            rand_val = random.random()
            if rand_val < 0.08:
                # Absent
                absent_count += 1
                sqls.append(f"""INSERT INTO hr.hr_attendance (attendance_id, date, employee_id, outlet_id, attendance_status, is_late, late_minutes, overtime_hours)
                               VALUES ('{att_id}', '{dt}', '{empid}', '{oid}', 'ABSENT', false, 0, 0)
                               ON CONFLICT (attendance_id) DO NOTHING;""")
            elif rand_val < 0.25:
                # Late
                present_count += 1
                late_count += 1
                late_min = random.randint(10, 45)
                sqls.append(f"""INSERT INTO hr.hr_attendance (attendance_id, date, employee_id, outlet_id, attendance_status, is_late, late_minutes, overtime_hours, check_in, check_out)
                               VALUES ('{att_id}', '{dt}', '{empid}', '{oid}', 'LATE', true, {late_min}, 0, '{dt} 08:{late_min:02d}:00', '{dt} 16:30:00')
                               ON CONFLICT (attendance_id) DO NOTHING;""")
            else:
                # Present On Time
                present_count += 1
                ot = random.choice([0, 0, 0, 1.5, 2.0])
                sqls.append(f"""INSERT INTO hr.hr_attendance (attendance_id, date, employee_id, outlet_id, attendance_status, is_late, late_minutes, overtime_hours, check_in, check_out)
                               VALUES ('{att_id}', '{dt}', '{empid}', '{oid}', 'PRESENT', false, 0, {ot}, '{dt} 07:55:00', '{dt} 16:05:00')
                               ON CONFLICT (attendance_id) DO NOTHING;""")
        
        # HR Daily Summary
        hr_sum_id = f"HRS-{dt}-{oid}"
        hr_issue = "none"
        hr_action = ""
        if late_count >= 2:
            hr_issue = f"{late_count} staf telat hadir"
            hr_action = f"Briefing SPV {oname} terkait disiplin jam masuk"
        elif absent_count > 0:
            hr_issue = f"{absent_count} staf tidak hadir tanpa keterangan"
            hr_action = f"Follow-up pengganti shift di {oname}"
            
        sqls.append(f"""INSERT INTO hr.hr_daily_summary (summary_id, date, brand, outlet, brand_id, outlet_id, total_staff, staff_present, staff_late, staff_absent, payroll_issue, major_hr_issue, recommended_action)
                       VALUES ('{hr_sum_id}', '{dt}', '{bname}', '{oname}', '{bid}', '{oid}', 5, {present_count}, {late_count}, {absent_count}, 'none', '{hr_issue}', '{hr_action}')
                       ON CONFLICT (summary_id) DO UPDATE SET staff_present={present_count}, staff_late={late_count}, staff_absent={absent_count};""")

        # 2. Finance Daily Summary & Expenses & POS
        base_rev = 3500000 + random.randint(500000, 3500000)
        expense = int(base_rev * random.uniform(0.35, 0.55))
        supplier_cost = int(expense * 0.6)
        petty_cash = int(expense * 0.15)
        unpaid = supplier_cost if random.random() < 0.3 else 0
        cash_diff = -75000 if (oid == "OL-005" and dt == dates[0]) else 0
        surplus = base_rev - expense
        
        fin_sum_id = f"FINS-{dt}-{oid}"
        fin_issue = "none"
        fin_action = ""
        if cash_diff != 0:
            fin_issue = f"Selisih kas closing {cash_diff} di {oname}"
            fin_action = f"Audit closing kas harian {oname}"
        elif unpaid > 0:
            fin_issue = f"Tagihan supplier belum terbayar Rp{unpaid:,}"
            fin_action = f"Jadwalkan pelunasan supplier {oname}"
            
        sqls.append(f"""INSERT INTO finance.fin_daily_summary (summary_id, date, brand, outlet, brand_id, outlet_id, revenue, expense, supplier_cost, petty_cash_out, unpaid_supplier, cash_difference, net_profit_estimate, major_finance_issue, recommended_action)
                       VALUES ('{fin_sum_id}', '{dt}', '{bname}', '{oname}', '{bid}', '{oid}', {base_rev}, {expense}, {supplier_cost}, {petty_cash}, {unpaid}, {cash_diff}, {surplus}, '{fin_issue}', '{fin_action}')
                       ON CONFLICT (summary_id) DO UPDATE SET revenue={base_rev}, expense={expense}, net_profit_estimate={surplus};""")

        # POS receipts count
        receipt_count = random.randint(35, 80)
        for r_idx in range(1, 10): # 10 representative receipts per outlet per day
            rc_id = f"POS-{dt}-{oid}-{r_idx:03d}"
            amount = random.randint(35000, 180000)
            sqls.append(f"""INSERT INTO finance.fin_pos_receipts (receipt_id, date, brand_id, brand_name, outlet_id, outlet_name, receipt_number, total_amount, subtotal, payment_method, cashier_name, transaction_time)
                           VALUES ('{rc_id}', '{dt}', '{bid}', '{bname}', '{oid}', '{oname}', 'RCP-{r_idx:04d}', {amount}, {amount}, 'QRIS', 'Kasir {oname}', '{dt} 12:{r_idx*5:02d}:00')
                           ON CONFLICT (receipt_id) DO NOTHING;""")

        # Expense entries
        exp_id = f"EXP-{dt}-{oid}-01"
        sqls.append(f"""INSERT INTO finance.fin_expense (expense_id, date, brand_id, brand_name, outlet_id, outlet_name, category, amount, payment_method, description, recorded_by)
                       VALUES ('{exp_id}', '{dt}', '{bid}', '{bname}', '{oid}', '{oname}', 'Bahan Baku', {supplier_cost}, 'BANK_TRANSFER', 'Pembelian bahan baku harian', 'Finance SPV')
                       ON CONFLICT (expense_id) DO NOTHING;""")

# 3. Hermez Alerts & Daily Briefs
alerts_data = [
    ("ALR-001", "2026-08-16", "warehouse", "CRITICAL", "BR-001", "OL-001", "Stok Kritis", "3 item stok kritis di Funkydak Cipete (ayam fillet, tepung terigu, minyak goreng)", "OPEN", "2026-08-16 14:30:00"),
    ("ALR-002", "2026-08-16", "finance", "HIGH", "BR-003", "OL-005", "Selisih Kas", "Selisih kas -Rp75.000 saat closing di Suburbuns Depok", "OPEN", "2026-08-16 21:30:00"),
    ("ALR-003", "2026-08-16", "ops", "HIGH", "BR-004", "OL-006", "Insiden Berat", "Kerusakan mesin espresso / kompor utama jam sibuk di Laju Kopi Bintaro", "OPEN", "2026-08-16 19:15:00"),
    ("ALR-004", "2026-08-15", "hr", "MEDIUM", "BR-002", "OL-004", "Kekurangan Shift", "2 staf tidak hadir shift malam Sekarpizza Seturan", "RESOLVED", "2026-08-15 17:00:00"),
    ("ALR-005", "2026-08-15", "warehouse", "MEDIUM", "BR-005", "OL-007", "Near Expiry", "5 kg saus marinasi mendekati masa kedaluwarsa Uncle Masala Tebet", "OPEN", "2026-08-15 10:00:00"),
    ("ALR-006", "2026-08-14", "finance", "LOW", "BR-002", "OL-003", "Tagihan Supplier", "Jatuh tempo pembayaran supplier CV Sayur Berkah besok", "ACKNOWLEDGED", "2026-08-14 09:00:00"),
]

for aid, adate, mod, sev, bid, oid, title, msg, st, created in alerts_data:
    sqls.append(f"""INSERT INTO hermez.hermez_alert_log (alert_id, date, module, severity, brand_id, outlet_id, title, message, status, created_at)
                   VALUES ('{aid}', '{adate}', '{mod}', '{sev}', '{bid}', '{oid}', '{title}', '{msg}', '{st}', '{created}')
                   ON CONFLICT (alert_id) DO NOTHING;""")

# Hermez Daily Brief for past 7 days
for d_idx, dt in enumerate(dates[:7]):
    brief_id = f"HZBR-{dt}"
    brief_content = f"""Ringkasan Eksekutif Hermez AI ({dt}):
- Total Estimasi Revenue: Rp38.500.000 (7 Outlet Aktif)
- Total Estimasi Surplus: Rp18.200.000
- Kehadiran SDM: 33 Hadir / 2 Izin / 0 Alpa
- Status Gudang: 2 Alert Restock (Funkydak Cipete & Laju Kopi)
- Status Operasional: Kesiapan Checklist 98%
- Rekomendasi Tindakan: Segera review purchase order bahan baku Funkydak dan verifikasi audit petty cash Suburbuns Depok."""
    sqls.append(f"""INSERT INTO hermez.hermez_daily_brief (brief_id, date, headline, summary_text, telegram_sent, created_at)
                   VALUES ('{brief_id}', '{dt}', 'Daily Brief YKP Command Center', '{brief_content}', true, '{dt} 22:00:00')
                   ON CONFLICT (brief_id) DO NOTHING;""")

print(f"Total SQL statements to execute: {len(sqls)}")
out, err = run_pg_batch(sqls)
print("EXECUTION COMPLETED:")
print(out[-1000:] if len(out) > 1000 else out)
if err:
    print("STDERR:\n", err[:1000])

ssh.close()
