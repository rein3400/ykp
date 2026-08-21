"""Patch VPS-only route files so they compile against the deployed code.

Two pre-existing VPS-only compile errors surfaced after the bugfix deploy
forced a fresh `npm run build` on the VPS (the old binary predated these files):

  1. ykp-ops-v1/src/app/api/ops/checklist/route.ts (VPS-only, not in repo)
     + page.tsx + mock-store.ts reference TABS.checklistSubmissions, but
     TABS has no such entry. Add the TABS entry + TAB_HEADERS entry.
  2. ykp-finance-v1/src/app/api/finance/pos/import/route.ts (VPS-only)
     reads parsed.warnings, but MokaImportResult never had a `warnings`
     field (pre-existing bug, masked by the old binary). Drop the line.

These are VPS-only files not present in the repo, so we patch them in place
on the VPS via SFTP read/edit/write.
"""
import paramiko, os, re

HOST = "187.77.114.168"
USER = "dev"
PASS = "password"
PATH = "/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=30)
sftp = ssh.open_sftp()


def read_remote(path):
    with sftp.open(path, "r") as f:
        return f.read().decode("utf-8")


def write_remote(path, content):
    with sftp.open(path, "w") as f:
        f.write(content)


# --- Fix 1: ops TABS.checklistSubmissions missing ---
ops_sheets = "/home/dev/ykp/ykp-ops-v1/src/db/sheets.ts"
src = read_remote(ops_sheets)
patched = False
if "checklistSubmissions" not in src:
    # add TABS entry after checklistTemplates
    src = src.replace(
        "  checklistTemplates: 'master_checklist_template',",
        "  checklistTemplates: 'master_checklist_template',\n"
        "  checklistSubmissions: 'ops_checklist_submission',",
    )
    # add TAB_HEADERS entry after checklistTemplates header block.
    # Insert before the briefing header block to keep order reasonable.
    src = src.replace(
        "  [TABS.briefing]:",
        "  [TABS.checklistSubmissions]: [\n"
        "    'submission_id', 'date', 'brand_id', 'outlet_id', 'shift_id',\n"
        "    'checklist_type', 'department', 'checklist_item', 'status',\n"
        "    'notes', 'critical_flag', 'photo_url', 'submitted_by', 'submitted_at',\n"
        "  ],\n"
        "  [TABS.briefing]:",
    )
    write_remote(ops_sheets, src)
    print("[PATCHED] ops sheets.ts — added checklistSubmissions TABS + headers")
    patched = True
else:
    print("[SKIP] ops sheets.ts — checklistSubmissions already present")

# Also patch mock-store to include the new tab key (VPS mock-store references it)
ops_mock = "/home/dev/ykp/ykp-ops-v1/src/db/mock-store.ts"
if os.path.exists(ops_mock.replace("/home/dev/ykp", "D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER")) is False:
    # VPS-only file; read from VPS
    try:
        mock_src = read_remote(ops_mock)
        if "checklistSubmissions" in mock_src and "'ops_checklist_submission'" not in mock_src and 'ops_checklist_submission' not in mock_src:
            # mock-store uses [TABS.checklistSubmissions]: [] — the TABS entry we just added makes this resolve.
            print("[OK] ops mock-store.ts — will resolve via new TABS entry")
        else:
            print("[SKIP] ops mock-store.ts — no action needed")
    except IOError:
        print("[SKIP] ops mock-store.ts — not found on VPS")

# --- Fix 2: finance pos/import parsed.warnings ---
fin_route = "/home/dev/ykp/ykp-finance-v1/src/app/api/finance/pos/import/route.ts"
src = read_remote(fin_route)
if "warnings: parsed.warnings" in src:
    src = src.replace("    warnings: parsed.warnings,\n", "")
    write_remote(fin_route, src)
    print("[PATCHED] finance pos/import/route.ts — dropped parsed.warnings (field absent from MokaImportResult)")
else:
    print("[SKIP] finance pos/import/route.ts — no parsed.warnings reference")

sftp.close()
ssh.close()
print("\nDONE patching VPS-only routes")