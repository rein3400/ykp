"""Check how the VPS attendance-service / attendance-geo reads outlet
latitude/longitude to understand why INSIDE_RADIUS worked despite the
master_outlet header mismatch."""
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
sftp = c.open_sftp()
for path in ["/home/dev/ykp/ykp-hr-v1/src/lib/attendance-geo.ts",
             "/home/dev/ykp/ykp-hr-v1/src/lib/attendance-service.ts"]:
    with sftp.open(path, "r") as f:
        print(f"===== {path} =====")
        print(f.read().decode("utf-8", "replace"))
        print()
sftp.close()
c.close()