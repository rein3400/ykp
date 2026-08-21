"""Verify authenticated flows on VPS-resident apps after bugfix2 deploy.

Uses SFTP-uploaded JSON body files to avoid PowerShell/SSH JSON-escaping issues.
For each app, log in as owner, capture the session cookie, then exercise fixes
that require auth.
"""
import paramiko, os, tempfile

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


def write_remote_tmp(content, name):
    path = f"/tmp/vf_{name}.json"
    with sftp.open(path, "w") as f:
        f.write(content)
    return path


def curl_login(port, body_file):
    cmd = (
        f"curl -s -i -X POST 'http://localhost:{port}/api/auth/login' "
        f"-H 'Content-Type: application/json' "
        f"--data-binary @{body_file} 2>&1 | head -25"
    )
    out, _ = run(cmd)
    cookie = None
    for line in out.splitlines():
        if line.lower().startswith("set-cookie:"):
            cookie = line.split(":", 1)[1].strip().split(";")[0]
            break
    return out, cookie


# Upload login bodies
hr_body = write_remote_tmp('{"username":"owner","password":"owner123"}', "hr_login")
ops_body = write_remote_tmp('{"username":"owner","password":"owner123"}', "ops_login")
wh_body = write_remote_tmp('{"username":"owner","password":"owner123"}', "wh_login")
inv_body = write_remote_tmp('{"username":"owner","password":"owner123"}', "inv_login")
fin_body = write_remote_tmp('{"username":"owner","password":"owner123"}', "fin_login")

print("===== LOGIN ATTEMPTS =====")
for name, port, body in [
    ("hr-v1", 3008, hr_body),
    ("ops", 3007, ops_body),
    ("warehouse", 3005, wh_body),
    ("investor", 3006, inv_body),
    ("finance", 3009, fin_body),
]:
    out, cookie = curl_login(port, body)
    status_line = out.splitlines()[0] if out else "(no output)"
    print(f"\n  {name}: {status_line}")
    if cookie:
        print(f"    cookie: {cookie[:50]}...")
        # Save cookie for later use
        with sftp.open(f"/tmp/vf_{name}_cookie.txt", "w") as f:
            f.write(cookie)
    else:
        print(f"    no cookie. body preview:")
        for line in out.splitlines()[:5]:
            print(f"      {line}")

ssh.close()
print("\nDONE")