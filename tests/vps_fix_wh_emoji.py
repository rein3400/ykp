"""Restore warehouse telegram.ts from git HEAD (preserves createLinkCode
dev feature) then re-apply the emoji fix (G�� -> calendar, etc.)."""
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("187.77.114.168", username="dev", password="password", timeout=30)

# 1) restore from git HEAD
_, out, err = c.exec_command("cd /home/dev/ykp/ykp-warehouse-v1 && git checkout HEAD -- src/lib/telegram.ts && echo OK")
print("restore:", out.read().decode().strip(), err.read().decode().strip())

# 2) read current content
sftp = c.open_sftp()
with sftp.open("/home/dev/ykp/ykp-warehouse-v1/src/lib/telegram.ts", "r") as f:
    src = f.read().decode("utf-8")

# 3) re-apply emoji fixes. The corrupted bytes are the UTF-8 replacement
#    char U+FFFD (\xEF\xBF\xBD) repeated — sometimes preceded by stray 'G'.
#    We replace the known bad lines with clean emoji versions.
replacements = [
    # header date line: "G��" before date
    ("  lines.push(`${brandName} G\uFFFD\uFFFD ${date}`);",
     "  lines.push(`${brandName} \U0001F4C5 ${date}`);"),
    # alert list line: "G��" before title
    ("      lines.push(`G\uFFFD\uFFFD ${a.title} (${a.severity})`);",
     "      lines.push(`\u26A0\uFE0F ${a.title} (${a.severity})`);"),
    # fraud watch lines
    ("  lines.push(`\uFFFD Waste hari ini: ${d.wasteToday.count} kasus (${formatRp(String(d.wasteToday.value))})`);",
     "  lines.push(`\U0001F5D1\uFE0F Waste hari ini: ${d.wasteToday.count} kasus (${formatRp(String(d.wasteToday.value))})`);"),
    ("  lines.push(`\uFFFD Stock adjustment: ${d.adjustmentsToday.pending} pending / ${d.adjustmentsToday.approved} approved`);",
     "  lines.push(`\U0001F527 Stock adjustment: ${d.adjustmentsToday.pending} pending / ${d.adjustmentsToday.approved} approved`);"),
    ("  lines.push(`\uFFFD Receiving discrepancy: ${d.receivingDiscrepanciesToday}`);",
     "  lines.push(`\U0001F4E5 Receiving discrepancy: ${d.receivingDiscrepanciesToday}`);"),
    ("    lines.push(`\uFFFD ?? Approval menggantung &gt;24 jam: ${d.staleApprovals}`);",
     "    lines.push(`\u23F0 Approval menggantung &gt;24 jam: ${d.staleApprovals}`);"),
]

count = 0
for old, new in replacements:
    if old in src:
        src = src.replace(old, new, 1)
        count += 1
    else:
        # try a fuzzier match: the replacement char may be a different count
        pass

# Also fix the BOM comment line if still present
src = src.replace(
    "  // Strip BOM / whitespace G\uFFFD\uFFFD Vercel env set via Windows PowerShell pipe can inject U+FEFF.",
    "  // Strip BOM / whitespace — Vercel env set via Windows PowerShell pipe can inject U+FEFF.",
)

# generic fallback: replace any remaining U+FFFD sequences with a safe marker
# (last resort — shouldn't hit if the targeted replacements above matched)
remaining = src.count("\uFFFD")
print(f"targeted replacements: {count}, remaining U+FFFD: {remaining}")

with sftp.open("/home/dev/ykp/ykp-warehouse-v1/src/lib/telegram.ts", "w") as f:
    f.write(src)
sftp.close()

# verify createLinkCode preserved + no replacement chars
_, out, _ = c.exec_command("grep -c createLinkCode /home/dev/ykp/ykp-warehouse-v1/src/lib/telegram.ts; grep -c $'\\xEF\\xbf\\xbd' /home/dev/ykp/ykp-warehouse-v1/src/lib/telegram.ts")
print("createLinkCode count:", out.readline().strip())
print("U+FFFD count:", out.readline().strip())
c.close()