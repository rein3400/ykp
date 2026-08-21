import paramiko

HOST = "187.77.114.168"
USER = "dev"
PWD = "password"

BASE = "/home/dev/ykp/ykp-ops-v1"

def apply(path, replacements):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PWD, timeout=30)
    sftp = c.open_sftp()
    with sftp.open(path, "r") as f:
        content = f.read().decode("utf-8")
    for old, new in replacements:
        n = content.count(old)
        if n != 1:
            print(f"FAIL {path}: count={n} for {old[:60]!r}")
            sftp.close(); c.close()
            return False
        content = content.replace(old, new)
    with sftp.open(path, "w") as f:
        f.write(content)
    sftp.close(); c.close()
    print(f"OK {path}")
    return True

# 1. remove Telegram item from sidebar
ok1 = apply(f"{BASE}/src/components/sidebar.tsx", [
    (
        "  { label: 'AI Assistant', href: '/ops/ai-assistant', roles: ['owner', 'ops_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'viewer'] },\n  { label: 'Telegram', href: '/ops/telegram', roles: ['owner', 'ops_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'staff', 'viewer'] },\n];",
        "  { label: 'AI Assistant', href: '/ops/ai-assistant', roles: ['owner', 'ops_admin', 'brand_manager', 'outlet_manager', 'supervisor', 'viewer'] },\n];"
    ),
])

# 2. delete files/dirs
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PWD, timeout=30)
for cmd in [
    f"rm -rf {BASE}/src/app/ops/telegram",
    f"rm -f {BASE}/src/components/telegram-link-client.tsx",
    f"rm -rf {BASE}/src/app/api/ops/telegram",
]:
    stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
    err = stderr.read().decode().strip()
    if err:
        print(f"RM ERR {cmd}: {err}")
    else:
        print(f"RM OK {cmd}")
c.close()

print("ALL:", ok1)
