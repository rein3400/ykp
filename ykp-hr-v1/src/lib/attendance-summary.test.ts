import { describe, expect, it } from 'vitest';
import { attendanceSummaryLines } from './attendance-summary';
describe('Telegram attendance summary',()=>{
 it('shows stored time as HH:MM WIB and canonical status without inventing a schedule',()=>{
  const text=attendanceSummaryLines({actual_check_in:'0:13',actual_check_out:'0:13',attendance_status:'PRESENT'}).join('\n');
  expect(text).toContain('00:13 WIB');expect(text).toContain('HADIR');expect(text).toContain('belum ditetapkan');expect(text).not.toContain('Status: -');
 });
 it('shows open attendance explicitly and escapes unknown status',()=>{
  const text=attendanceSummaryLines({actual_check_in:'08:10',actual_check_out:'',attendance_status:'<bad>',scheduled_check_in:'8:00'}).join('\n');
  expect(text).toContain('belum absen pulang');expect(text).toContain('08:00 WIB');expect(text).toContain('&lt;bad&gt;');
 });
});
