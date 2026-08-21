"""Sync the merged files into the local repo working tree so local == VPS,
then re-run audit_deploy_gap.py to confirm 0 DIFF / 0 SKIP-DEV."""
import os
import shutil

REV = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "rev")
REPO = os.path.dirname(REV)

# (merged-filename, repo-relative dest)
MAP = [
    ("ykp-hr-v1__src__db__sheets.ts",        "ykp-hr-v1/src/db/sheets.ts"),
    ("ykp-finance-v1__src__db__sheets.ts",   "ykp-finance-v1/src/db/sheets.ts"),
    ("ykp-investor-v1__src__db__sheets.ts",  "ykp-investor-v1/src/db/sheets.ts"),
    ("ykp-ops-v1__src__db__sheets.ts",       "ykp-ops-v1/src/db/sheets.ts"),
    ("ykp-warehouse-v1__src__db__sheets.ts", "ykp-warehouse-v1/src/db/sheets.ts"),
    ("ykp-finance-v1__src__lib__telegram.ts", "ykp-finance-v1/src/lib/telegram.ts"),
    ("ykp-warehouse-v1__src__lib__telegram.ts", "ykp-warehouse-v1/src/lib/telegram.ts"),
]

for src_name, dest_rel in MAP:
    src = os.path.join(REV, "merged", src_name)
    dst = os.path.join(REPO, dest_rel.replace("/", os.sep))
    shutil.copyfile(src, dst)
    print(f"synced {src_name} -> {dest_rel}")
print("DONE. Now run audit_deploy_gap.py.")