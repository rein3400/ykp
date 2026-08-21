"""Check which TABS keys exist in each app's sheets.ts on VPS."""
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
for app in ["ykp-hr-v1","ykp-finance-v1","ykp-warehouse-v1","ykp-investor-v1","ykp-ops-v1"]:
    p = f"/home/dev/ykp/{app}/src/db/sheets.ts"
    _, out, _ = c.exec_command(f"grep -oE 'telegramLinkCodes|investorUsers|opsUsers' {p} | sort -u")
    found = out.read().decode().strip().replace("\n", ", ")
    _, out2, _ = c.exec_command(f"grep -c 'telegramLinkCodes' {p}")
    cnt = out2.read().decode().strip()
    print(f"{app}: telegramLinkCodes_count={cnt}  unique_refs=[{found}]")
c.close()