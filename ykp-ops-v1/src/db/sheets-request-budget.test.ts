import { beforeAll, describe, expect, it, vi } from 'vitest';
const client=vi.hoisted(()=>({get:vi.fn(async()=>({data:{values:[['user_id','username'],['U1','owner']]}})),append:vi.fn(async()=>({data:{updates:{updatedRange:'ops_telegram_session!A5:F5'}}})),update:vi.fn(async()=>({data:{}}))}));
vi.mock('googleapis',()=>({google:{auth:{JWT:class{}},sheets:()=>({spreadsheets:{values:client}})}}));
vi.mock('./mock-store',()=>({isMockMode:()=>false}));
vi.mock('./postgres',()=>({isPostgresMode:()=>false}));
import {readTab,updateRow,appendRows,TABS} from './sheets';
beforeAll(()=>{process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL='test@example.invalid';process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY='test';process.env.YKP_OPS_SPREADSHEET_ID='test';});
describe('bot Sheets request budget',()=>{
 it('keeps users cached when a different tab session is written',async()=>{
  await readTab(TABS.users);const reads=client.get.mock.calls.length;
  await updateRow(TABS.telegramSessions,2,{chat_id:'123456'});await readTab(TABS.users);
  expect(client.get.mock.calls.length).toBe(reads);
 });
 it('appends without pre-reading column A and returns actual row from Sheets',async()=>{
  const reads=client.get.mock.calls.length;
  expect(await appendRows(TABS.telegramSessions,[{chat_id:'123456'}])).toEqual({startRow:5});
  expect(client.get.mock.calls.length).toBe(reads);
 });
});
