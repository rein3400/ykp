import { describe, expect, it, vi } from 'vitest';
import { POST } from './route';
const state=vi.hoisted(()=>({rows:[{attendance_id:'A1',employee_id:'E1',date:'2020-01-01',actual_check_in:'08:00',notes:'[tg-update:123456:100]'}]}));
const append=vi.hoisted(()=>vi.fn());
const update=vi.hoisted(()=>vi.fn(async()=>undefined));
vi.mock('@/db/sheets',async original=>({...await original<typeof import('@/db/sheets')>(),readTab:async(tab:string)=>tab==='users'?[{user_id:'U1',employee_id:'E1',telegram_id:'123456',active_status:'active'}]:state.rows,appendRows:append,updateRow:update,findRow:async()=>({rowNumber:2,row:state.rows[0]})}));
vi.mock('@/lib/repo',()=>({assertEmployee:async()=>undefined,nextSequentialId:async()=> 'UNUSED'}));
describe('alternate bot check-in replay',()=>{
 it('persists receipts even when the employee was already clocked in',async()=>{
  const {todayWib}=await import('@/lib/format');
  const previous=state.rows[0].date;state.rows[0].date=todayWib();vi.stubEnv('TELEGRAM_BOT_SECRET','test-only');
  try {
   const response=await POST(new Request('http://localhost',{method:'POST',headers:{'x-bot-secret':'test-only'},body:JSON.stringify({telegram_chat_id:'123456',telegram_update_id:101})}),{params:Promise.resolve({})});
   expect(response.status).toBe(200);expect(update).toHaveBeenCalledWith(expect.any(String),2,expect.objectContaining({notes:expect.stringContaining('[tg-update:123456:101]')}));
  } finally {state.rows[0].date=previous;vi.unstubAllEnvs();}
 });
 it('does not create a new attendance on another day for a previously processed GPS update',async()=>{
  vi.stubEnv('TELEGRAM_BOT_SECRET','test-only');
  try{
   const response=await POST(new Request('http://localhost/api/hr/telegram/clock-in',{method:'POST',headers:{'x-bot-secret':'test-only'},body:JSON.stringify({telegram_chat_id:'123456',telegram_update_id:100})}),{params:Promise.resolve({})});
   expect(response.status).toBe(200);expect((await response.json()).data.already).toBe(true);expect(append).not.toHaveBeenCalled();
  }finally{vi.unstubAllEnvs();}
 });
});
