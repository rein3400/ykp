"""Check valueInputOption status in VPS sheets.ts files."""
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
for app in ["ykp-finance-v1","ykp-warehouse-v1","ykp-investor-v1","ykp-hr-v1"]:
    p = f"/home/dev/ykp/{app}/src/db/sheets.ts"
    _, out, _ = c.exec_command(f"grep -c USER_ENTERED {p}; grep -c \"valueInputOption: 'RAW'\" {p}")
    ue = out.readline().strip()
    raw = out.readline().strip()
    print(f"{app}: USER_ENTERED={ue} RAW={raw}")
c.close()