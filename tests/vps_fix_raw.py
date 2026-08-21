"""Apply the USER_ENTERED -> RAW fix in-place on the VPS sheets.ts for a given app."""
import paramiko, sys

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

apps = [
    ("ykp-hr-v1", "src/db/sheets.ts"),
    ("ykp-finance-v1", "src/db/sheets.ts"),
    ("ykp-warehouse-v1", "src/db/sheets.ts"),
    ("ykp-investor-v1", "src/db/sheets.ts"),
]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=30)

for app, rel in apps:
    path = f"/home/dev/ykp/{app}/{rel}"
    # Read current content
    stdin, stdout, stderr = c.exec_command(f"cat {path}")
    content = stdout.read().decode()
    err = stderr.read().decode()
    if err:
        print(f"{app}: READ ERR {err}")
        continue
    before = content.count("valueInputOption: 'USER_ENTERED'")
    fixed = content.replace("valueInputOption: 'USER_ENTERED'", "valueInputOption: 'RAW'")
    after = fixed.count("valueInputOption: 'USER_ENTERED'")
    # Write back via SFTP
    sftp = c.open_sftp()
    with sftp.open(path, "w") as f:
        f.write(fixed)
    sftp.close()
    print(f"{app}: replaced {before} occurrences, remaining USER_ENTERED={after}")

c.close()