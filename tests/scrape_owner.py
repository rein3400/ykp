import paramiko
import re

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('187.77.114.168', username='dev', password='password')

cookie = "ykp_owner_session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJodWItc3NvLW93bmVyIiwidXNlcm5hbWUiOiJvd25lciIsInJvbGUiOiJvd25lciIsImlhdCI6MTc4Njg1ODYwMCwiZXhwIjoxNzg2OTQ1MDAwfQ.jahuZGHjKchXfNOJpWgq7FBIm7LIs5-VctkJtbaMpC0"
cmd = f"curl -s -b '{cookie}' 'http://187.77.114.168:3010/owner'"
stdin, stdout, stderr = ssh.exec_command(cmd)
html = stdout.read().decode('utf-8', errors='ignore')
ssh.close()

clean_text = re.sub(r'<[^<]+?>', ' ', html)
clean_text = ' '.join(clean_text.split())
print("LENGTH:", len(html))
print("CLEAN TEXT SAMPLE:")
print(clean_text[:3000])
