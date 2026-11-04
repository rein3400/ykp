export function normalizeShiftTime(raw: string): string {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(raw.trim());
  if (!match || Number(match[1]) > 23) throw new Error('Jam shift harus format HH:MM yang valid');
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}
