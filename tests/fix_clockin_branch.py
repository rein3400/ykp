import paramiko

HOST = "187.77.114.168"
USER = "dev"
PWD = "password"

path = "/home/dev/ykp/ykp-hr-v1/src/app/api/hr/attendance/telegram/route.ts"

old = """  if (intent === 'clock-in') {
    const loc = msg.location;
    if (!loc) {
      await reply('Kirim lokasi kamu untuk absen masuk. Tekan tombol "Kirim Lokasi" di bawah, atau kirim lokasi dari 📎 → Location.', locationReplyMarkup());
      return ok({ ok: true });
    }
    const result = await performClockIn({
      employeeId: employee.employee_id,
      latitude: loc.latitude,
      longitude: loc.longitude,
      actor: { userId: actorUserId, role: actorRole, employeeId: employee.employee_id },
      source: 'telegram'
    });
    if (!result.ok) {
      await reply(`❌ Gagal absen masuk: ${escapeHtml(result.error.message)}`);
      return ok({ ok: true, error: result.error });
    }
    if (result.already) {
      await reply('ℹ️ Sudah absen masuk hari ini sebelumnya.');
      return ok({ ok: true, already: true });
    }
    const r = result.row;
    const locLabel = r.check_in_location === 'INSIDE_RADIUS' ? 'di dalam radius outlet' : 'di luar radius outlet';
    await reply(
      `✅ Absen masuk tercatat.\\n\\nJam: ${escapeHtml(r.actual_check_in)}\\nStatus: ${escapeHtml(r.attendance_status)}\\nLokasi: ${locLabel}`
    );
    return ok({ ok: true, attendance_id: r.attendance_id });
  }"""

new = """  if (intent === 'clock-in') {
    // Location is handled above (msg.location triggers clock-in directly).
    // Reaching here means the user sent /masuk without a location.
    await reply('Kirim lokasi kamu untuk absen masuk. Tekan tombol "Kirim Lokasi" di bawah, atau kirim lokasi dari 📎 → Location.', locationReplyMarkup());
    return ok({ ok: true });
  }"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PWD, timeout=30)
sftp = c.open_sftp()
with sftp.open(path, "r") as f:
    content = f.read().decode("utf-8")
n = content.count(old)
if n != 1:
    print(f"FAIL: pattern count={n}")
else:
    content = content.replace(old, new)
    with sftp.open(path, "w") as f:
        f.write(content)
    print("OK: clock-in branch simplified")
sftp.close()
c.close()
