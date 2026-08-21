import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

# Health check all v1 apps + check what sheet IDs each expects
apps = {
    'ykp-hr-v1': 3008,
    'ykp-finance-v1': 3009,
    'ykp-ops-v1': 3007,
    'ykp-warehouse-v1': 3005,
    'ykp-investor-v1': 3006,
    'ykp-owner-v1': 3010,
}
for app, port in apps.items():
    cmd = f"curl -s -m 8 -o /dev/null -w '{app} root=%{{http_code}} ' http://localhost:{port}/; curl -s -m 8 -o /dev/null -w 'api=%{{http_code}}\\n' http://localhost:{port}/api/health 2>/dev/null || echo 'no-health'"
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
    print(stdout.read().decode().strip())

# Check what sheet IDs each v1 app's code expects
cmd2 = "grep -rn 'SPREADSHEET_ID\\|spreadsheetId\\|1rdKV6BJ' /home/dev/ykp/ykp-finance-v1/src/db/ /home/dev/ykp/ykp-ops-v1/src/db/ /home/dev/ykp/ykp-warehouse-v1/src/db/ /home/dev/ykp/ykp-investor-v1/src/db/ /home/dev/ykp/ykp-owner-v1/src/db/ 2>/dev/null | head -30"
stdin, stdout, stderr = ssh.exec_command(cmd2, timeout=30)
print('--- sheet id refs in v1 apps ---')
print(stdout.read().decode())

ssh.close()
