import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

queries = [
    "SELECT count(*) FROM master.master_brand;",
    "SELECT count(*) FROM master.master_outlet;",
    "SELECT count(*) FROM master.master_employee;",
    "SELECT count(*) FROM hr.hr_attendance;",
    "SELECT count(*) FROM hr.hr_daily_summary;",
    "SELECT count(*) FROM hr.hr_payroll;",
    "SELECT count(*) FROM finance.fin_daily_summary;",
    "SELECT count(*) FROM finance.fin_pos_receipts;",
    "SELECT count(*) FROM finance.fin_expense;",
    "SELECT count(*) FROM hermez.hermez_alert_log;",
    "SELECT count(*) FROM hermez.hermez_daily_brief;"
]

for q in queries:
    cmd = f"""echo password | sudo -S docker exec ykp-postgres psql -U ykp -d ykp_erp -c "{q}" """
    stdin, stdout, stderr = ssh.exec_command(cmd)
    res = stdout.read().decode().strip()
    # parse the count
    lines = [l.strip() for l in res.split('\n') if l.strip() and not l.startswith('count') and not l.startswith('-') and not l.startswith('[sudo]')]
    val = lines[-1] if lines else '0'
    print(f"{q:50} -> {val}")

ssh.close()
