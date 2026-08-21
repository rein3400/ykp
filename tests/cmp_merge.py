import os, paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=20)
sftp = c.open_sftp()
rel = "ykp-finance-v1/src/db/sheets.ts"
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
local_path = os.path.join(REPO, rel.replace("/", os.sep))
remote_path = "/home/dev/ykp/" + rel
with open(local_path, "r", encoding="utf-8") as f:
    local = f.read()
with sftp.open(remote_path, "rb") as rf:
    vps = rf.read().decode("utf-8", errors="replace")
local_n = local.replace("\r\n", "\n")
vps_n = vps.replace("\r\n", "\n")
# find first diff
for i in range(min(len(local_n), len(vps_n))):
    if local_n[i] != vps_n[i]:
        print("first diff at", i)
        print("local ctx:", repr(local_n[max(0, i-40):i+40]))
        print("vps   ctx:", repr(vps_n[max(0, i-40):i+40]))
        break
else:
    if len(local_n) != len(vps_n):
        print("prefix same, len differs")
        print("local tail:", repr(local_n[-60:]))
        print("vps tail:", repr(vps_n[-60:]))
    else:
        print("identical?! but strip differs")
        print("local last 60:", repr(local_n[-60:]))
        print("vps last 60:", repr(vps_n[-60:]))
c.close()