"""Verify HR correction RBAC (fix #3) using the saved hr-v1 cookie."""
import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=30)
sftp = ssh.open_sftp()


def run(cmd, timeout=30):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    return stdout.read().decode().strip(), stderr.read().decode().strip()


with sftp.open("/tmp/vf_hr-v1_cookie.txt", "r") as f:
    ck = f.read().decode().strip()
print(f"cookie: {ck[:40]}...")

# Write body to remote file
body = '{"attendance_id":"HRR-OL-20260821-001","reason":"test","correction_type":"check_in","requested_check_in":"2026-08-21T08:00:00"}'
with sftp.open("/tmp/vt_corr.json", "w") as f:
    f.write(body)

print("\n===== FIX #3: hr correction RBAC =====")
out, _ = run(f"curl -s -X POST 'http://localhost:3008/api/hr/attendance/correction' -H 'Cookie: {ck}' -H 'Content-Type: application/json' --data-binary @/tmp/vt_corr.json | head -c 400")
print(f"  correction response: {out}")
out2, _ = run(f"curl -s -o /dev/null -w '%{{http_code}}' -X POST 'http://localhost:3008/api/hr/attendance/correction' -H 'Cookie: {ck}' -H 'Content-Type: application/json' --data-binary @/tmp/vt_corr.json")
print(f"  HTTP {out2}")
print("  (expect 403 forbidden — RBAC enforced; 400 if attendance_id not found but RBAC passed; 201 only if bug remains)")

ssh.close()
print("\nDONE")