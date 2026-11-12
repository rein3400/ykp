import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
const rows=vi.hoisted(()=>[{employee_id:'E1',notes:'clock-in via telegram | [tg-update:123456:100]'}]);
const reply=vi.hoisted(()=>vi.fn(async(_token:string,_chatId:number,_text:string,_markup?:unknown)=>1));
const open=vi.hoisted(()=>vi.fn(async():Promise<{attendance_id:string}|null>=>({attendance_id:'A1'})));
const clockOut=vi.hoisted(()=>vi.fn());const clockIn=vi.hoisted(()=>vi.fn());
vi.mock('@/db/sheets',async original=>({...await original<typeof import('@/db/sheets')>(),readTab:async()=>rows}));
vi.mock('@/lib/attendance-lookup',()=>({findEmployeeByTelegramId:async()=>({employee_id:'E1'}),findUserByEmployeeId:async()=>({user_id:'U1',role:'employee'}),findOpenAttendance:open}));
vi.mock('@/lib/attendance-service',()=>({performClockIn:clockIn,performClockOut:clockOut}));
vi.mock('@/lib/telegram-attendance',async original=>({...await original<typeof import('@/lib/telegram-attendance')>(),sendTelegramText:reply}));
beforeEach(()=>{clockIn.mockReset();clockOut.mockReset();reply.mockClear();open.mockReset();open.mockResolvedValue({attendance_id:'A1'});});
afterEach(()=>vi.unstubAllEnvs());
describe('GPS webhook retry',()=>{
 it('shows stored WIB check-in time when attendance already exists without writing again',async()=>{
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET','test-secret');vi.stubEnv('TELEGRAM_BOT_TOKEN','test-token');
  reply.mockClear();clockOut.mockClear();open.mockResolvedValueOnce(null);
  clockIn.mockResolvedValueOnce({ok:true,already:true,row:{actual_check_in:'08:17',actual_check_out:''}});
  const response=await POST(new Request('http://localhost/api/hr/attendance/telegram',{method:'POST',headers:{'x-telegram-bot-api-secret-token':'test-secret'},body:JSON.stringify({update_id:101,message:{chat:{id:123456},from:{id:123456},location:{latitude:-7.7,longitude:110.3}}})}),{params:Promise.resolve({})});
  expect(response.status).toBe(200);
  expect(reply).toHaveBeenCalledWith('test-token',123456,expect.stringContaining('08:17 WIB'),undefined);
  expect(clockOut).not.toHaveBeenCalled();clockIn.mockClear();
 });
 it('shows existing checkout and never asks a closed attendance to punch out again',async()=>{
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET','test-secret');vi.stubEnv('TELEGRAM_BOT_TOKEN','test-token');
  open.mockResolvedValueOnce(null);clockIn.mockResolvedValueOnce({ok:true,already:true,row:{actual_check_in:'08:17',actual_check_out:'17:01'}});
  await POST(new Request('http://localhost',{method:'POST',headers:{'x-telegram-bot-api-secret-token':'test-secret'},body:JSON.stringify({update_id:102,message:{chat:{id:123456},from:{id:123456},location:{latitude:-7.7,longitude:110.3}}})}),{params:Promise.resolve({})});
  const text=reply.mock.calls[0]?.[2];expect(text).toContain('17:01 WIB');expect(text).toContain('sudah ditutup');expect(text).not.toContain('Kirim lokasi baru');
 });
 it('does not turn a previously persisted check-in into checkout on replay',async()=>{
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET','test-secret');vi.stubEnv('TELEGRAM_BOT_TOKEN','test-token');
  const response=await POST(new Request('http://localhost/api/hr/attendance/telegram',{method:'POST',headers:{'x-telegram-bot-api-secret-token':'test-secret'},body:JSON.stringify({update_id:100,message:{chat:{id:123456},from:{id:123456},location:{latitude:-7.7,longitude:110.3}}})}),{params:Promise.resolve({})});
  expect(response.status).toBe(200);expect(clockOut).not.toHaveBeenCalled();expect(clockIn).not.toHaveBeenCalled();
 });
});
