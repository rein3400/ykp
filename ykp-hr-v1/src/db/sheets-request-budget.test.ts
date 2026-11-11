import { beforeAll, describe, expect, it, vi } from 'vitest';
const values=vi.hoisted(()=>({get:vi.fn(async()=>({data:{values:[['username','user_id'],['owner','U1']]}})),append:vi.fn(async()=>({data:{updates:{updatedRange:'audit_log!A2:Z2'}}})),update:vi.fn(async()=>({data:{}}))}));
vi.mock('googleapis',()=>({google:{auth:{JWT:class{}},sheets:()=>({spreadsheets:{values}})}}));
vi.mock('./mock-store',()=>({isMockMode:()=>false}));vi.mock('./postgres',()=>({isPostgresMode:()=>false}));
import {readTab,findRow,appendRows,TABS} from './sheets';
beforeAll(()=>{process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL='test@example.invalid';process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY='test';process.env.YKP_HR_SPREADSHEET_ID='test';});
describe('HR lookup request budget',()=>{
 it('reuses cached header-aware rows for lookups and does not truncate at 1000',async()=>{
  await readTab(TABS.users);const count=values.get.mock.calls.length;
  expect(await findRow(TABS.users,'user_id','U1')).toEqual({rowNumber:2,row:{username:'owner',user_id:'U1'}});
  expect(values.get.mock.calls.length).toBe(count);
  const args=values.get.mock.calls[0] as unknown as [{range:string}];expect(args[0].range).not.toContain('1000');
 });
 it('retains users cache when writing unrelated audit tab',async()=>{
  const count=values.get.mock.calls.length;await appendRows(TABS.auditLog,[{audit_id:'A1'}]);await readTab(TABS.users);
  expect(values.get.mock.calls.length).toBe(count);
 });
});
