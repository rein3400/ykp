"""Read warehouse sheets.ts via SSH exec with explicit exit-status wait."""
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
path = "/home/dev/ykp/ykp-warehouse-v1/src/db/sheets.ts"
chan = c.get_transport().open_session()
chan.exec_command(f"cat {path}")
out = b""
while True:
    if chan.recv_ready():
        out += chan.recv(65536)
    if chan.recv_stderr_ready():
        err = chan.recv_stderr(65536).decode()
        if err:
            print("STDERR:", err)
    if chan.exit_status_ready() and not chan.recv_ready() and not chan.recv_stderr_ready():
        break
# final drain
while chan.recv_ready():
    out += chan.recv(65536)
status = chan.recv_exit_status()
print("exit:", status, "bytes:", len(out))
print("first 200:", out[:200].decode("utf-8","ignore"))
print("has as const:", b"as const" in out)
c.close()