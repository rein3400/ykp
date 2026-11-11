export function telegramAttendanceMarker(chatId: number, updateId: number): string {
  if (!Number.isSafeInteger(chatId) || !Number.isSafeInteger(updateId) || updateId < 0) throw new Error('Invalid Telegram update identity');
  return `[tg-update:${chatId}:${updateId}]`;
}
export function hasTelegramAttendanceUpdate(rows: Record<string, string>[], employeeId: string, chatId: number, updateId: number): boolean {
  const marker = telegramAttendanceMarker(chatId, updateId);
  return rows.some(row => row.employee_id === employeeId && (row.notes ?? '').includes(marker));
}
