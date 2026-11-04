export function activeShift(row: Record<string, string>): boolean {
  const status = (row.active_status?.trim() || row.status?.trim() || '').toLowerCase();
  return status === 'active' || status === '1';
}
