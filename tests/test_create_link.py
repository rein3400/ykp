import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"

PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"

# Write a small tsx test script on the VPS that calls createLinkCode for each division
script = r'''
import { createLinkCode } from './src/lib/telegram';

async function main() {
  const div = process.argv[2];
  const userId = process.argv[3];
  const code = await createLinkCode(userId);
  console.log('CODE=' + code + ' DIV=' + div + ' USER=' + userId);
}
main();
'''

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASS, timeout=30)
sftp = c.open_sftp()

for app_dir, div, user_id in [
    ("ykp-finance-v1", "finance", "U-EMP-1"),
    ("ykp-warehouse-v1", "warehouse", "USR-MEGA-001"),
    ("ykp-investor-v1", "investor", "USR-INV-002"),
    ("ykp-ops-v1", "ops", "USR-001"),
]:
    # write test script
    with sftp.open(f'/home/dev/ykp/{app_dir}/test-link.ts', 'w') as f:
        f.write(script)
    cmd = (
        f"export PATH={PATH}; cd /home/dev/ykp/{app_dir} && "
        f"set -a && . ./.env && set +a && "
        f"npx tsx test-link.ts {div} {user_id} 2>&1"
    )
    stdin, stdout, stderr = c.exec_command(cmd, timeout=120)
    out = stdout.read().decode()
    err = stderr.read().decode()
    print(f"=== {app_dir} ({div}) ===")
    print(out.strip())
    if err.strip():
        print("STDERR:", err.strip()[-500:])
    # cleanup
    sftp.remove(f'/home/dev/ykp/{app_dir}/test-link.ts')

c.close()
print("DONE")
