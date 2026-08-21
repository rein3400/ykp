"""SSH to VPS, read warehouse telegram.ts, verify emoji are clean (no U+FFFD)."""
import subprocess, sys

CMD = (
    "cd /home/dev/ykp/ykp-warehouse-v1 && python3 -c \""
    "import io,sys;"
    "p='src/lib/telegram.ts';"
    "d=open(p,'rb').read().decode('utf-8');"
    "print('U+FFFD count:', d.count(chr(0xFFFD)));"
    "print('has_calendar:', chr(0x1F4C5) in d);"
    "print('has_warn:', chr(0x26A0) in d);"
    "print('has_waste:', chr(0x1F5D1) in d);"
    "print('has_wrench:', chr(0x1F527) in d);"
    "print('has_inbox:', chr(0x1F4E5) in d);"
    "print('has_timer:', chr(0x23F0) in d);"
    "print('createLinkCode:', 'createLinkCode' in d)"
    "\""
)

r = subprocess.run(["python", "tests/vps_ssh.py", CMD], capture_output=True, text=True)
print("exit:", r.returncode)
print(r.stdout)
if r.stderr:
    print("STDERR:", r.stderr)