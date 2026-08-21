"""Run a python one-liner on VPS via SFTP+exec to avoid PowerShell quote mangling."""
import paramiko, sys, textwrap

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)

script = '''
import re
for p in ["/home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts",
          "/home/dev/ykp/ykp-investor-v1/src/db/sheets.ts",
          "/home/dev/ykp/ykp-hr-v1/src/db/sheets.ts"]:
    s = open(p, "rb").read()
    m = re.search(rb"\\} as const;.{0,20}export type", s, re.S)
    print(p, "->", repr(m.group()) if m else "NO MATCH")
'''
sftp = c.open_sftp()
with sftp.open("/tmp/probe_tabs.py", "w") as f:
    f.write(script)
sftp.close()
_, out, err = c.exec_command("python3 /tmp/probe_tabs.py")
print(out.read().decode())
print("ERR:", err.read().decode())
c.close()