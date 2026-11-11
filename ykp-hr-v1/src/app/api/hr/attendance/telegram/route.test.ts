import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
const rows=vi.hoisted(()=>[{employee_id:'E1',notes:'clock-in via telegram | [tg-update:123456:100]'}]);
const clockOut=vi.hoisted(()=>vi.fn());const clockIn=vi.hoisted(()=>vi.fn());
vi.mock('@/db/sheets',async original=>({...await original<typeof import('@/db/sheets')>(),readTab:async()=>rows}));
vi.mock('@/lib/attendance-lookup',()=>({findEmployeeByTelegramId:async()=>({employee_id:'E1'}),findUserByEmployeeId:async()=>({user_id:'U1',role:'employee'}),findOpenAttendance:async()=>({attendance_id:'A1'})}));
vi.mock('@/lib/attendance-service',()=>({performClockIn:clockIn,performClockOut:clockOut}));
vi.mock('@/lib/telegram-attendance',async original=>({...await original<typeof import('@/lib/telegram-attendance')>(),sendTelegramText:async()=>1}));
afterEach(()=>vi.unstubAllEnvs());
describe('GPS webhook retry',()=>{
 it('does not turn a previously persisted check-in into checkout on replay',async()=>{
  vi.stubEnv('TELEGRAM_WEBHOOK_SECRET','test-secret');vi.stubEnv('TELEGRAM_BOT_TOKEN','test-token');
  const response=await POST(new Request('http://localhost/api/hr/attendance/telegram',{method:'POST',headers:{'x-telegram-bot-api-secret-token':'test-secret'},body:JSON.stringify({update_id:100,message:{chat:{id:123456},from:{id:123456},location:{latitude:-7.7,longitude:110.3}}})}),{params:Promise.resolve({})});
  expect(response.status).toBe(200);expect(clockOut).not.toHaveBeenCalled();expect(clockIn).not.toHaveBeenCalled();
 });
});
