import paramiko
import random
from datetime import datetime, timedelta

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

def run_pg_batch(sqls):
    joined = "\n".join(sqls)
    sftp = ssh.open_sftp()
    with sftp.file('/tmp/seed_data_v2.sql', 'w') as f:
        f.write(joined)
    sftp.close()
    cmd = "echo password | sudo -S docker cp /tmp/seed_data_v2.sql ykp-postgres:/tmp/seed_data_v2.sql && echo password | sudo -S docker exec ykp-postgres psql -U ykp -d ykp_erp -f /tmp/seed_data_v2.sql"
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

print("Generating 14 days of transactional data with proper lower-case enums...")

for dt in dates:
    for oid, bid, oname, bname in outlets:
        present_count = 0
        late_count = 0
        absent_count = 0
        
        outlet_emp_offset = (int(oid.split('-')[1]) - 1) * 5
        for e_idx in range(1, 6):
            emp_num = outlet_emp_offset + e_idx
            empid = f"EMP-{emp_num:05d}"
            att_id = f"ATT-{dt}-{empid}"
            
            rand_val = random.random()
            if rand_val < 0.05:
                # Absent
                absent_count += 1
                sqls.append(f"""INSERT INTO hr.hr_attendance (attendance_id, date, employee_id, outlet_id, attendance_status, is_late, late_minutes, overtime_hours)
                               VALUES ('{att_id}', '{dt}', '{empid}', '{oid}', 'absent', false, 0, 0)
                               ON CONFLICT (attendance_id) DO UPDATE SET attendance_status='absent';""")
            elif rand_val < 0.20:
                # Late
                present_count += 1
                late_count += 1
                late_min = random.randint(10, 45)
                sqls.append(f"""INSERT INTO hr.hr_attendance (attendance_id, date, employee_id, outlet_id, attendance_status, is_late, late_minutes, overtime_hours, check_in, check_out)
                               VALUES ('{att_id}', '{dt}', '{empid}', '{oid}', 'present', true, {late_min}, 0, '{dt} 08:{late_min:02d}:00', '{dt} 16:30:00')
                               ON CONFLICT (attendance_id) DO UPDATE SET attendance_status='present', is_late=true, late_minutes={late_min};""")
            else:
                # Present On Time
                present_count += 1
                ot = random.choice([0, 0, 0, 1.5, 2.0])
                sqls.append(f"""INSERT INTO hr.hr_attendance (attendance_id, date, employee_id, outlet_id, attendance_status, is_late, late_minutes, overtime_hours, check_in, check_out)
                               VALUES ('{att_id}', '{dt}', '{empid}', '{oid}', 'present', false, 0, {ot}, '{dt} 07:55:00', '{dt} 16:05:00')
                               ON CONFLICT (attendance_id) DO UPDATE SET attendance_status='present', is_late=false, late_minutes=0;""")
        
        hr_sum_id = f"HRS-{dt}-{oid}"
        hr_issue = "none"
        hr_action = ""
        if late_count >= 2:
            hr_issue = f"{late_count} staf telat hadir"
            hr_action = f"Briefing SPV {oname} terkait disiplin jam masuk"
        elif absent_count > 0:
            hr_issue = f"{absent_count} staf tidak hadir"
            hr_action = f"Follow-up pengganti shift di {oname}"
            
        sqls.append(f"""INSERT INTO hr.hr_daily_summary (summary_id, date, brand, outlet, brand_id, outlet_id, total_staff, staff_present, staff_late, staff_absent, payroll_issue, major_hr_issue, recommended_action)
                       VALUES ('{hr_sum_id}', '{dt}', '{bname}', '{oname}', '{bid}', '{oid}', 5, {present_count}, {late_count}, {absent_count}, 'none', '{hr_issue}', '{hr_action}')
                       ON CONFLICT (summary_id) DO UPDATE SET staff_present={present_count}, staff_late={late_count}, staff_absent={absent_count};""")

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

        for r_idx in range(1, 10):
            rc_id = f"POS-{dt}-{oid}-{r_idx:03d}"
            amount = random.randint(35000, 180000)
            sqls.append(f"""INSERT INTO finance.fin_pos_receipts (receipt_id, date, brand_id, brand_name, outlet_id, outlet_name, receipt_number, total_amount, subtotal, payment_method, cashier_name, transaction_time)
                           VALUES ('{rc_id}', '{dt}', '{bid}', '{bname}', '{oid}', '{oname}', 'RCP-{r_idx:04d}', {amount}, {amount}, 'QRIS', 'Kasir {oname}', '{dt} 12:{r_idx*5:02d}:00')
                           ON CONFLICT (receipt_id) DO NOTHING;""")

        exp_id = f"EXP-{dt}-{oid}-01"
        sqls.append(f"""INSERT INTO finance.fin_expense (expense_id, date, brand_id, brand_name, outlet_id, outlet_name, category, amount, payment_method, description, recorded_by)
                       VALUES ('{exp_id}', '{dt}', '{bid}', '{bname}', '{oid}', '{oname}', 'Bahan Baku', {supplier_cost}, 'BANK_TRANSFER', 'Pembelian bahan baku harian', 'Finance SPV')
                       ON CONFLICT (expense_id) DO NOTHING;""")

print(f"Total SQL statements to execute: {len(sqls)}")
out, err = run_pg_batch(sqls)
print("EXECUTION COMPLETED:")
print(out[-800:] if len(out) > 800 else out)
if err and "ERROR" in err:
    print("STDERR:\n", err[:1000])

ssh.close()
