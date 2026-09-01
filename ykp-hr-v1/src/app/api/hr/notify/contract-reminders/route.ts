import { readTab, TABS } from '@/db/sheets';
import { ok, unauthorized, handler } from '@/lib/http';
import { isCronAuthorized } from '@/lib/cron';
import { getReminderCandidates } from '@/lib/employment-contract';
import { sendTelegram } from '@/lib/telegram';
import { todayWib } from '@/lib/format';

export const GET = handler(async () => {
  const employees = await readTab<Record<string, string>>(TABS.employees);
  const today = todayWib();
  const candidates = getReminderCandidates(employees, today);
  return ok({ date: today, candidates });
});

export const POST = handler(async (req) => {
  if (!isCronAuthorized(req)) return unauthorized('Invalid or missing CRON_SECRET');

  const employees = await readTab<Record<string, string>>(TABS.employees);
  const today = todayWib();
  const candidates = getReminderCandidates(employees, today);

  if (candidates.length === 0) return ok({ date: today, sent: 0, candidates: [] });

  const lines: string[] = [];
  lines.push('\u23F0 <b>Reminder Kontrak Karyawan</b> \u2014 ' + today);
  lines.push('');
  for (const c of candidates) {
    const kindLabel = c.kind === 'PROBATION_ENDING' ? 'Probation' : 'Kontrak';
    const urgency = c.daysRemaining <= 1 ? '\u26A0\uFE0F' : c.daysRemaining <= 3 ? '\u26A1' : '\uD83D\uDCC5';
    lines.push(urgency + ' <b>' + c.employeeName + '</b> (' + c.employeeId + ') \u2014 ' + kindLabel + ' berakhir <b>' + c.targetDate + '</b> (' + c.daysRemaining + ' hari lagi) \u2014 Status: ' + c.employmentStatus + ' \u2014 Join: ' + c.joinDate);
  }
  lines.push('');
  lines.push('Total probation + kontrak = 14 bulan sebelum permanent. Mohon tindak lanjut HR.');

  const text = lines.join('\n');
  const result = await sendTelegram({
    sourceModule: 'hr',
    sourceReferenceId: 'contract-reminder-' + today,
    messageType: 'CONTRACT_REMINDER',
    recipient: '',
    text
  });

  return ok({ date: today, sent: candidates.length, candidates, telegram: result });
});