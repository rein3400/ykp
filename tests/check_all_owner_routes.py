import paramiko
import re

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cookie = "ykp_owner_session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJodWItc3NvLW93bmVyIiwidXNlcm5hbWUiOiJvd25lciIsInJvbGUiOiJvd25lciIsImlhdCI6MTc4Njg1ODYwMCwiZXhwIjoxNzg2OTQ1MDAwfQ.jahuZGHjKchXfNOJpWgq7FBIm7LIs5-VctkJtbaMpC0"

routes = [
    '/owner',
    '/owner/keuangan',
    '/owner/penjualan',
    '/owner/bukti',
    '/owner/sdm',
    '/owner/gudang',
    '/owner/operasional',
    '/owner/investor',
    '/owner/activity',
    '/owner/brief',
    '/owner/health'
]

for r in routes:
    cmd = f"curl -s -b '{cookie}' 'http://187.77.114.168:3010{r}'"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    html = stdout.read().decode('utf-8', errors='ignore')
    clean = ' '.join(re.sub(r'<[^<]+?>', ' ', html).split())
    has_error = "404" in clean or "500" in clean or "error" in clean.lower()
    print(f"ROUTE: {r:20} | Length: {len(html):6} | Sample: {clean[:120]}")

ssh.close()
