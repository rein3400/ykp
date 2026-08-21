"""Flush PM2 logs, send an absen webhook, then read fresh logs to confirm
no error was thrown by the attendance telegram route."""
import paramiko, json, time

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)
PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"
SECRET = "1295afef2950bc42a1b1076f9079ecb190a467c1725c9b52"
CHAT = 5721500978

# 1. Flush logs
stdin, stdout, stderr = c.exec_command(
    f"export PATH={PATH}; pm2 flush ykp-hr-v1 2>&1 | tail -2", timeout=30
)
print("FLUSH:", stdout.read().decode("utf-8", "replace"))

# 2. Send /help + /masuk-no-loc
for name, text in [("help", "/help"), ("masuk-no-loc", "/masuk")]:
    body = json.dumps({"message": {"chat": {"id": CHAT}, "text": text}})
    cmd = (
        f"export PATH={PATH}; "
        f"cat > /tmp/wb.json <<'EOF'\n{body}\nEOF\n"
        f"curl -s -w '\\nHTTP=%{{http_code}}\\n' -X POST "
        f"http://localhost:3008/api/hr/attendance/telegram "
        f"-H 'Content-Type: application/json' "
        f"-H 'x-telegram-bot-api-secret-token: {SECRET}' "
        f"--data-binary @/tmp/wb.json"
    )
    stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
    print(f"=== {name} ===")
    print(stdout.read().decode("utf-8", "replace"))

# 3. Wait + read fresh logs
time.sleep(2)
stdin, stdout, stderr = c.exec_command(
    f"export PATH={PATH}; pm2 logs ykp-hr-v1 --lines 20 --nostream 2>&1", timeout=30
)
print("=== FRESH LOGS ===")
print(stdout.read().decode("utf-8", "replace"))
c.close()