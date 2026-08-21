"""Read last few rows of telegram_delivery_log from the shared sheet to
inspect the warehouse brief message text (verify emoji are clean)."""
import os, sys
sys.path.insert(0, "tests")
from tg_cli import sheets_client, read_tab  # reuse CLI's helpers

sid = os.environ["YKP_HR_SPREADSHEET_ID"]
rows = read_tab(sid, "telegram_delivery_log", 60)
# warehouse entries: filter by message_type or module
print(f"total rows read: {len(rows)}")
# show last 8 with module + status + message preview
for r in rows[-12:]:
    mt = r.get("message_type", "")
    mod = r.get("module", r.get("source_module", ""))
    status = r.get("status", "")
    sent = r.get("sent_at", r.get("created_at", ""))
    err = r.get("error_message", "")
    # message_text column varies
    text = r.get("message_text") or r.get("message") or r.get("text") or ""
    print(f"[{status}] mod={mod} type={mt} at={sent}")
    if text:
        print(f"    text: {text[:200]}")
    if err:
        print(f"    err: {err[:80]}")