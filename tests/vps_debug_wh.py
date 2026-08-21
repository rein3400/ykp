"""Debug: try patch warehouse specifically with verbose marker check."""
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)

path = "/home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts"
_, out, _ = c.exec_command(f"cat {path}")
src = out.read().decode()
print("has telegramLinkCodes:", "telegramLinkCodes" in src)
eol = "\r\n" if "\r\n" in src else "\n"
print("eol:", repr(eol))
mA = f"}} as const;{eol}{eol}export type TabName"
mB = f"}} as const;{eol}export type TabName"
print("mA in src:", mA in src)
print("mB in src:", mB in src)
# show the actual region
idx = src.find("} as const;")
print("region:", repr(src[idx:idx+60]))
c.close()