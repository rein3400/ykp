"""Targeted comma fix: find any line ending with a value (no trailing comma)
immediately followed by "  telegramLinkCodes:" and add the comma."""
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)

script = r'''
import re
path = "/home/dev/ykp/ykp-hr-v1/src/db/sheets.ts"
with open(path, "r", encoding="utf-8") as f:
    src = f.read()
# Match: <prop>: '<val>' (no comma at EOL) then newline then telegramLinkCodes line.
# The preceding line may be any property. EOL may be \n or \r\n.
pat = re.compile(
    r"(\n  [A-Za-z_]+: '[^']+')(\r?\n  telegramLinkCodes: 'telegram_link_codes',)",
)
new, n = pat.subn(lambda m: m.group(1) + "," + m.group(2), src)
print(f"replacements: {n}")
if n:
    with open(path, "w", encoding="utf-8") as f:
        f.write(new)
    idx = new.find("telegramLinkCodes")
    print("region:", repr(new[idx-70:idx+60]))
else:
    print("no match")
'''
sftp = c.open_sftp()
with sftp.open("/tmp/fix_hr_comma.py", "w") as f:
    f.write(script)
sftp.close()
_, out, err = c.exec_command("python3 /tmp/fix_hr_comma.py")
print(out.read().decode())
e = err.read().decode()
if e: print("ERR:", e)
c.close()