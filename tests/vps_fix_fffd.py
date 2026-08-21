"""Replace remaining U+FFFD (in comments) with em-dash."""
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
sftp = c.open_sftp()
path = "/home/dev/ykp/ykp-warehouse-v1/src/lib/telegram.ts"
with sftp.open(path, "r") as f:
    src = f.read().decode("utf-8")
before = src.count("\uFFFD")
# U+FFFD preceded/followed by space → em-dash; the surrounding bytes are
# mangled so just replace each standalone replacement char.
src = src.replace("\uFFFD", "\u2014")  # em-dash
with sftp.open(path, "w") as f:
    f.write(src)
print(f"replaced {before} U+FFFD with em-dash")
# verify
with sftp.open(path, "r") as f:
    after = f.read().decode("utf-8")
print("remaining U+FFFD:", after.count("\uFFFD"))
print("createLinkCode:", after.count("createLinkCode"))
c.close()