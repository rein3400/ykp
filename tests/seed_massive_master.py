import paramiko
import random
from datetime import datetime, timedelta

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

def run_pg(sql):
    escaped_sql = sql.replace('"', '\\"').replace('$', '\\$')
    cmd = f"""echo password | sudo -S docker exec ykp-postgres psql -U ykp -d ykp_erp -c "{escaped_sql}" """
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    return out, err

print("=== 1. MASTER SEED ===")
# Brands
brands = [
    ("BR-001", "Funkydak", "FD", "ACTIVE"),
    ("BR-002", "Sekarpizza", "SP", "ACTIVE"),
    ("BR-003", "Suburbuns", "SB", "ACTIVE"),
    ("BR-004", "Laju Kopi", "LK", "ACTIVE"),
    ("BR-005", "Uncle Masala", "UM", "ACTIVE"),
]
for bid, bname, bcode, st in brands:
    run_pg(f"""INSERT INTO master.master_brand (brand_id, brand_name, brand_code, status) 
               VALUES ('{bid}', '{bname}', '{bcode}', '{st}') 
               ON CONFLICT (brand_id) DO UPDATE SET brand_name='{bname}', status='{st}';""")

# Outlets
outlets = [
    ("OL-001", "BR-001", "Funkydak Cipete", "FD-CPT", "Jakarta Selatan", "08:00", "22:00", "Asia/Jakarta", "ACTIVE"),
    ("OL-002", "BR-001", "Funkydak Kemang", "FD-KMG", "Jakarta Selatan", "08:00", "22:00", "Asia/Jakarta", "ACTIVE"),
    ("OL-003", "BR-002", "Sekarpizza Demangan", "SP-DMG", "Yogyakarta", "10:00", "23:00", "Asia/Jakarta", "ACTIVE"),
    ("OL-004", "BR-002", "Sekarpizza Seturan", "SP-STR", "Yogyakarta", "10:00", "23:00", "Asia/Jakarta", "ACTIVE"),
    ("OL-005", "BR-003", "Suburbuns Depok", "SB-DPK", "Depok", "07:00", "21:00", "Asia/Jakarta", "ACTIVE"),
    ("OL-006", "BR-004", "Laju Kopi Bintaro", "LK-BTR", "Tangerang Selatan", "07:00", "22:00", "Asia/Jakarta", "ACTIVE"),
    ("OL-007", "BR-005", "Uncle Masala Tebet", "UM-TBT", "Jakarta Selatan", "10:00", "22:00", "Asia/Jakarta", "ACTIVE"),
]
for oid, bid, oname, ocode, city, st, en, tz, status in outlets:
    run_pg(f"""INSERT INTO master.master_outlet (outlet_id, brand_id, outlet_name, outlet_code, city, opening_time, closing_time, timezone, status) 
               VALUES ('{oid}', '{bid}', '{oname}', '{ocode}', '{city}', '{st}', '{en}', '{tz}', '{status}') 
               ON CONFLICT (outlet_id) DO UPDATE SET outlet_name='{oname}', status='{status}';""")

# Suppliers
suppliers = [
    ("SUP-0001", "CV Sumber Ayam Segar", "Ayam & Unggas", "08123456701", "ayam@sumberayam.com", "ACTIVE"),
    ("SUP-0002", "PT Pangan Nusantara", "Bahan Kering & Tepung", "08123456702", "order@pangannusantara.com", "ACTIVE"),
    ("SUP-0003", "UD Sayur Berkah", "Sayuran & Bumbu", "08123456703", "sayur@berkah.com", "ACTIVE"),
    ("SUP-0004", "PT Dairy Prima Utama", "Keju & Susu", "08123456704", "sales@dairyprima.com", "ACTIVE"),
    ("SUP-0005", "CV Kemasan Sentosa", "Packaging & Cup", "08123456705", "info@kemasansentosa.com", "ACTIVE"),
    ("SUP-0006", "PT Gas & Minyakindo", "Minyak Goreng & LPG", "08123456706", "order@gasminyak.com", "ACTIVE"),
]
for sid, sname, cat, ph, em, st in suppliers:
    run_pg(f"""INSERT INTO master.master_supplier (supplier_id, supplier_name, category, phone, email, status) 
               VALUES ('{sid}', '{sname}', '{cat}', '{ph}', '{em}', '{st}') 
               ON CONFLICT (supplier_id) DO UPDATE SET supplier_name='{sname}';""")

# Employees (35 employees across 7 outlets)
names = [
    ("Ahmad", "Fauzi"), ("Budi", "Santoso"), ("Citra", "Lestari"), ("Dewi", "Anggraini"), ("Eko", "Prasetyo"),
    ("Fajar", "Nugroho"), ("Gita", "Gutawa"), ("Hadi", "Kusuma"), ("Indra", "Wijaya"), ("Joko", "Susilo"),
    ("Kartika", "Sari"), ("Lukman", "Hakim"), ("Mega", "Utami"), ("Nanda", "Pratama"), ("Oscar", "Lawalata"),
    ("Putri", "Rahayu"), ("Qori", "Sandioriva"), ("Rian", "Hidayat"), ("Siti", "Nurhaliza"), ("Taufik", "Hidayat"),
    ("Umar", "Wirahadikusuma"), ("Vina", "Panduwinata"), ("Wawan", "Setiawan"), ("Xenia", "Aprillia"), ("Yusuf", "Mansur"),
    ("Zul", "Zivilia"), ("Adit", "Sopo"), ("Bambang", "Pamungkas"), ("Cici", "Pani"), ("Doni", "Kusuma"),
    ("Endang", "Sukses"), ("Fitri", "Tropica"), ("Gunawan", "Dwi"), ("Hesti", "Purwadinata"), ("Imam", "Darto")
]

roles = ["SUPERVISOR", "CASHIER", "KITCHEN", "BARISTA", "SERVICE"]
for idx, (fn, ln) in enumerate(names, start=1):
    empid = f"EMP-{idx:05d}"
    fullname = f"{fn} {ln}"
    outlet = outlets[(idx - 1) % len(outlets)]
    oid = outlet[0]
    bid = outlet[1]
    role = roles[(idx - 1) % len(roles)]
    salary = 3800000 + ((idx * 150000) % 2500000)
    run_pg(f"""INSERT INTO master.master_employee (employee_id, brand_id, outlet_id, full_name, role, basic_salary, status)
               VALUES ('{empid}', '{bid}', '{oid}', '{fullname}', '{role}', {salary}, 'ACTIVE')
               ON CONFLICT (employee_id) DO UPDATE SET full_name='{fullname}';""")

print("Master data populated successfully!")
ssh.close()
