"""Read TAB_HEADERS for audit_log + a few others from the VPS ykp-hr-v1
sheets.ts (SKIP-DEV copy) to see what layout the VPS code expects vs the
live sheet vs the repo local sheets.ts."""
import paramiko, re
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
sftp = c.open_sftp()
with sftp.open("/home/dev/ykp/ykp-hr-v1/src/db/sheets.ts", "r") as f:
    src = f.read().decode("utf-8", "replace")
sftp.close()
c.close()

for key in ["auditLog", "users", "attendance", "outlets", "employees"]:
    m = re.search(r"\[TABS\." + key + r"\]:\s*\[([^\]]+)\]", src)
    if m:
        cols = [x.strip().strip("'").strip('"') for x in m.group(1).split(',') if x.strip() and not x.strip().startswith("//")]
        print(f"VPS TAB_HEADERS.{key} ({len(cols)} cols): {cols}")
    else:
        print(f"VPS TAB_HEADERS.{key}: NOT FOUND")