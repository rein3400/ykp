import paramiko

HOST = "187.77.114.168"
USER = "dev"
PASSWORD = "password"

cmd = r"""
probe() {
  local url="$1"
  local code=$(curl -s -o /tmp/probe.out -w '%{http_code}' --max-time 8 "$url")
  echo "$url -> $code : $(head -c 200 /tmp/probe.out)"
}
probe https://hr-v1.oseedigital.tech/api/hr/summary/count
probe https://finance-v1.oseedigital.tech/api/finance/summary/count
probe https://finance-v1.oseedigital.tech/api/fin/summary
probe https://warehouse.oseedigital.tech/api/warehouse/summary/count
probe https://investor.oseedigital.tech/api/investor/summary/count
probe https://ops.oseedigital.tech/api/ops/summary/count
probe https://owner.oseedigital.tech/login
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PASSWORD, timeout=30)
stdin, stdout, stderr = c.exec_command(cmd)
print(stdout.read().decode())
print(stderr.read().decode())
c.close()
