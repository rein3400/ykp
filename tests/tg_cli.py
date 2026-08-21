#!/usr/bin/env python3
"""
YKP Telegram CLI (MVP) — test harness for the Telegram integrations.

Simulates Telegram webhook updates against the live V1 apps and reads back
the delivery/attendance state from Google Sheets, so we can exercise the
bot flows end-to-end WITHOUT sending real messages to the owner.

Usage:
  python tests/tg_cli.py simulate hr --chat-id 5721500978 --text "/masuk"
  python tests/tg_cli.py simulate hr --chat-id 5721500978 --location -6.2741 110.4075
  python tests/tg_cli.py simulate finance-daily-brief
  python tests/tg_cli.py read-log finance
  python tests/tg_cli.py read-attendance --employee-id EMP-00001

Secrets come from env vars (never hardcoded):
  TG_WEBHOOK_SECRET   -> X-Telegram-Bot-Api-Secret-Token header
  TG_CRON_SECRET      -> x-cron-secret header for cron endpoints
  GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  YKP_HR_SPREADSHEET_ID / YKP_FINANCE_SPREADSHEET_ID
"""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error


def _load_env_file(path):
    """Minimal .env loader (KEY=VALUE, # comments) — real env always wins."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if os.environ.get(k) is None:
                    os.environ[k] = v
    except FileNotFoundError:
        pass


# Load a CLI-local .env (tests/tg_cli.env) if present, then fall back to the
# repo VPS-style env files. Lets the tester keep secrets in one place without
# exporting per-shell.
_HERE = os.path.dirname(os.path.abspath(__file__))
for _candidate in (
    os.path.join(_HERE, "tg_cli.env"),
    os.path.join(_HERE, "..", ".env"),
    os.path.join(_HERE, "..", "ykp-hr-v1", ".env"),
):
    _load_env_file(_candidate)

BASE = {
    "hr": "https://hr-v1.oseedigital.tech",
    "finance": "https://finance-v1.oseedigital.tech",
    "warehouse": "https://warehouse.oseedigital.tech",
    "investor": "https://investor.oseedigital.tech",
    "ops": "https://ops.oseedigital.tech",
    "owner": "https://owner.oseedigital.tech",
}


def post(url, payload, headers=None):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")
    except urllib.error.URLError as e:
        return 0, {"error": str(e)}


def tg_update(chat_id, text=None, location=None):
    msg = {"chat": {"id": chat_id, "type": "private"}, "from": {"id": chat_id}}
    if text is not None:
        msg["text"] = text
    if location is not None:
        msg["location"] = {"latitude": location[0], "longitude": location[1]}
    return {"update_id": 1, "message": msg}


def cmd_simulate(args):
    secret = os.environ.get("TG_WEBHOOK_SECRET") or os.environ.get("TELEGRAM_WEBHOOK_SECRET") or ""
    headers = {"X-Telegram-Bot-Api-Secret-Token": secret} if secret else {}

    if args.target == "hr":
        loc = None
        if args.location:
            loc = (float(args.location[0]), float(args.location[1]))
        payload = tg_update(int(args.chat_id), args.text, loc)
        url = f"{BASE['hr']}/api/hr/attendance/telegram"
    elif args.target == "finance-daily-brief":
        cron = os.environ.get("TG_CRON_SECRET") or os.environ.get("CRON_SECRET") or ""
        headers = {"x-cron-secret": cron}
        payload = {}
        url = f"{BASE['finance']}/api/finance/notify/daily-brief"
    elif args.target == "warehouse-daily-brief":
        cron = os.environ.get("TG_CRON_SECRET") or os.environ.get("CRON_SECRET") or ""
        headers = {"x-cron-secret": cron}
        payload = {}
        url = f"{BASE['warehouse']}/api/warehouse/notify/daily-brief"
    elif args.target == "investor-daily-brief":
        cron = os.environ.get("TG_CRON_SECRET") or os.environ.get("CRON_SECRET") or ""
        headers = {"x-cron-secret": cron}
        payload = {}
        url = f"{BASE['investor']}/api/investor/notify/daily-brief"
    else:
        print(f"Unknown target: {args.target}")
        sys.exit(1)

    status, body = post(url, payload, headers)
    print(f"POST {url}")
    print(f"  status: {status}")
    print(f"  body: {json.dumps(body, ensure_ascii=False, indent=2)}")


def sheets_client():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    email = os.environ.get("GOOGLE_SERVICE_ACCOUNT_EMAIL")
    key = os.environ.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "").replace("\\n", "\n")
    if not email or not key:
        print("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")
        sys.exit(1)
    creds = service_account.Credentials.from_service_account_info(
        {
            "type": "service_account",
            "client_email": email,
            "private_key": key,
            "token_uri": "https://oauth2.googleapis.com/token",
        },
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    return build("sheets", "v4", credentials=creds)


def read_tab(spreadsheet_id, tab, limit=20):
    svc = sheets_client()
    r = svc.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range=f"{tab}!A1:Z{limit + 1}"
    ).execute()
    rows = r.get("values", [])
    if not rows:
        return []
    headers = rows[0]
    out = []
    for row in rows[1:]:
        out.append({h: (row[i] if i < len(row) else "") for i, h in enumerate(headers)})
    return out


def cmd_read_log(args):
    sid = os.environ.get("YKP_FINANCE_SPREADSHEET_ID") or os.environ.get("YKP_HR_SPREADSHEET_ID")
    if not sid:
        print("Missing spreadsheet id env")
        sys.exit(1)
    rows = read_tab(sid, "telegram_delivery_log", args.limit)
    print(f"telegram_delivery_log ({len(rows)} rows):")
    for r in rows:
        print(f"  [{r.get('status')}] {r.get('message_type')} -> {r.get('recipient')} "
              f"at {r.get('sent_at')} err={r.get('error_message')}")


def cmd_read_attendance(args):
    sid = os.environ.get("YKP_HR_SPREADSHEET_ID")
    if not sid:
        print("Missing YKP_HR_SPREADSHEET_ID")
        sys.exit(1)
    # Tab name is hr_attendance (per TABS in ykp-hr-v1/src/db/sheets.ts).
    rows = read_tab(sid, "hr_attendance", args.limit)
    if args.employee_id:
        rows = [r for r in rows if r.get("employee_id") == args.employee_id]
    print(f"attendance ({len(rows)} rows):")
    for r in rows:
        print(f"  {r.get('employee_id')} {r.get('date')} in={r.get('actual_check_in')} "
              f"out={r.get('actual_check_out')} status={r.get('attendance_status')} "
              f"loc={r.get('check_in_location')}")


def main():
    p = argparse.ArgumentParser(description="YKP Telegram CLI (MVP)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("simulate", help="Simulate a Telegram webhook update")
    s.add_argument("target", choices=["hr", "finance-daily-brief", "warehouse-daily-brief", "investor-daily-brief"])
    s.add_argument("--chat-id", default="5721500978")
    s.add_argument("--text", default=None)
    s.add_argument("--location", nargs=2, metavar=("LAT", "LON"), default=None)
    s.set_defaults(func=cmd_simulate)

    r = sub.add_parser("read-log", help="Read telegram_delivery_log from Sheets")
    r.add_argument("module", choices=["finance", "hr", "warehouse", "investor"])
    r.add_argument("--limit", type=int, default=20)
    r.set_defaults(func=cmd_read_log)

    a = sub.add_parser("read-attendance", help="Read attendance tab from HR Sheets")
    a.add_argument("--employee-id", default=None)
    a.add_argument("--limit", type=int, default=20)
    a.set_defaults(func=cmd_read_attendance)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
