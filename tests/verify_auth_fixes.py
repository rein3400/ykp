"""Verify authenticated fix behaviors on VPS after bugfix2 deploy.

Uses session cookies saved by verify_auth_login.py (/tmp/vf_<app>_cookie.txt).
Tests the highest-impact fixes that require auth:
  - finance audit redaction (#1 CRITICAL)
  - warehouse receiving qty_accepted>qty_delivered (#13)
  - warehouse stock-issue SoD (#8)
  - finance petty-cash daily_limit (#7)
  - finance closing-cash NaN parse (#4)
  - hr correction RBAC (#3 HIGH, via employee vs hr_admin session)
"""
import paramiko, os

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


def cookie(app):
    try:
        with sftp.open(f"/tmp/vf_{app}_cookie.txt", "r") as f:
            return f.read().decode().strip()
    except IOError:
        return None


def write_tmp(content, name):
    path = f"/tmp/vt_{name}.json"
    with sftp.open(path, "w") as f:
        f.write(content)
    return path


print("===== FIX #1: finance audit redaction (CRITICAL) =====")
ck = cookie("finance")
if ck:
    out, _ = run(f"curl -s 'http://localhost:3009/api/finance/audit' -H 'Cookie: {ck}' | head -c 800")
    print(f"  audit response (first 800): {out}")
    if "before_value" in out or "after_value" in out:
        print("  [FAIL] before_value/after_value LEAKED — redaction not working")
    else:
        print("  [OK] no before_value/after_value in authenticated response — redaction works")
else:
    print("  [SKIP] no finance cookie")

print("\n===== FIX #4: finance closing-cash NaN parse =====")
ck = cookie("finance")
if ck:
    # valid formatted amount → should parse to 500000
    body = write_tmp('{"opening_cash":"Rp 500.000","actual_cash":500000}', "cc_ok")
    out, _ = run(f"curl -s -X POST 'http://localhost:3009/api/finance/closing-cash' -H 'Cookie: {ck}' -H 'Content-Type: application/json' --data-binary @{body} | head -c 300")
    print(f"  Rp 500.000 -> {out}")
    if '"opening_cash":"500000"' in out or '"opening_cash":500000' in out or ('500000' in out and 'NaN' not in out):
        print("  [OK] formatted amount parsed to 500000 (no NaN)")
    else:
        print("  [INFO] check format above for NaN")
    # non-numeric → should 400
    body2 = write_tmp('{"opening_cash":"abc","actual_cash":500000}', "cc_bad")
    out2, _ = run(f"curl -s -o /dev/null -w '%{{http_code}}' -X POST 'http://localhost:3009/api/finance/closing-cash' -H 'Cookie: {ck}' -H 'Content-Type: application/json' --data-binary @{body2}")
    print(f"  'abc' -> HTTP {out2} (expect 400)")
else:
    print("  [SKIP] no finance cookie")

print("\n===== FIX #7: finance petty-cash daily_limit =====")
ck = cookie("finance")
if ck:
    # huge credit_out → should exceed daily_limit → 400
    body = write_tmp('{"account_id":"petty-1","debit_topup":0,"credit_out":999999999,"note":"test"}', "pc_over")
    out, _ = run(f"curl -s -o /dev/null -w '%{{http_code}}' -X POST 'http://localhost:3009/api/finance/petty-cash' -H 'Cookie: {ck}' -H 'Content-Type: application/json' --data-binary @{body}")
    print(f"  credit_out 999999999 -> HTTP {out} (expect 400 if daily_limit enforced; 200/201 if no account configured)")
else:
    print("  [SKIP] no finance cookie")

print("\n===== FIX #13: warehouse receiving qty_accepted > qty_delivered =====")
ck = cookie("warehouse")
if ck:
    body = write_tmp('{"items":[{"item_id":"ITM-001","location_id":"LOC-001","qty_delivered":10,"qty_accepted":15}]}', "recv_bad")
    out, _ = run(f"curl -s -o /dev/null -w '%{{http_code}}' -X POST 'http://localhost:3005/api/warehouse/receiving' -H 'Cookie: {ck}' -H 'Content-Type: application/json' --data-binary @{body}")
    print(f"  accepted 15 > delivered 10 -> HTTP {out} (expect 400)")
    # also test a normal accepted <= delivered
    body2 = write_tmp('{"items":[{"item_id":"ITM-001","location_id":"LOC-001","qty_delivered":10,"qty_accepted":8}]}', "recv_ok")
    out2, _ = run(f"curl -s -o /dev/null -w '%{{http_code}}' -X POST 'http://localhost:3005/api/warehouse/receiving' -H 'Cookie: {ck}' -H 'Content-Type: application/json' --data-binary @{body2}")
    print(f"  accepted 8 <= delivered 10 -> HTTP {out2} (control: 200/201 or 400 if FK missing)")
else:
    print("  [SKIP] no warehouse cookie")

print("\n===== FIX #8: warehouse stock-issue SoD =====")
ck = cookie("warehouse")
if ck:
    # issued_by === requested_by → 400. We don't know the userId; issue with both
    # empty so they default to the same session user → self-issue → 400.
    body = write_tmp('{"items":[{"item_id":"ITM-001","location_id":"LOC-001","qty":5}]}', "issue_self")
    out, _ = run(f"curl -s -o /dev/null -w '%{{http_code}}' -X POST 'http://localhost:3005/api/warehouse/stock-issue' -H 'Cookie: {ck}' -H 'Content-Type: application/json' --data-binary @{body}")
    print(f"  self-issue (default requested_by=issued_by=session) -> HTTP {out}")
    print("  (expect 400 if SoD enforced; 201 if SoD only triggers when both explicit)")
else:
    print("  [SKIP] no warehouse cookie")

print("\n===== FIX #3: hr correction RBAC (employee self-only) =====")
ck = cookie("hr")
if ck:
    # Without an employee_id in session, this may 403/400. We check that a
    # correction POST with a fake attendance_id is NOT 201 (the empty RBAC
    # block previously let any user correct anyone).
    body = write_tmp('{"attendance_id":"HRR-OL-20260821-001","reason":"test","correction_type":"check_in","requested_check_in":"2026-08-21T08:00:00"}', "corr_cross")
    out, _ = run(f"curl -s -o /dev/null -w '%{{http_code}}' -X POST 'http://localhost:3008/api/hr/attendance/correction' -H 'Cookie: {ck}' -H 'Content-Type: application/json' --data-binary @{body}")
    print(f"  correction POST -> HTTP {out}")
    print("  (expect 403/400 — RBAC enforced, not 201 created)")
else:
    print("  [SKIP] no hr cookie")

ssh.close()
print("\nDONE")