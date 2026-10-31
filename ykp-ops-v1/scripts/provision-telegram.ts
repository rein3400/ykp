import { getSheetsClient, getSpreadsheetId, TABS } from '../src/db/sheets';
import { OPS_COMMANDS, OPS_SESSION_HEADERS, sessionTabAction } from '../src/lib/telegram-provision';

async function main(): Promise<void> {
 if(process.env.USE_MOCK_DB==='true'||process.env.USE_POSTGRES==='true')throw new Error('Provisioning requires verified Sheets backend; Postgres schema migration must be performed separately');
 const sheets=getSheetsClient(),spreadsheetId=getSpreadsheetId();
 const meta=await sheets.spreadsheets.get({spreadsheetId,fields:'sheets.properties.title'});
 const exists=meta.data.sheets?.some(s=>s.properties?.title===TABS.telegramSessions);
 const headers=exists?(await sheets.spreadsheets.values.get({spreadsheetId,range:`'${TABS.telegramSessions}'!1:1`})).data.values?.[0]??[]:undefined;
 const action=sessionTabAction(headers);
 if(action==='write_headers') {
  const content=await sheets.spreadsheets.values.get({spreadsheetId,range:`'${TABS.telegramSessions}'!A2:Z`});
  if(content.data.values?.some(row=>row.some(value=>String(value).trim()!=='')))throw new Error('Session tab contains data without headers; reviewed migration required');
 }
 if(action==='create')await sheets.spreadsheets.batchUpdate({spreadsheetId,requestBody:{requests:[{addSheet:{properties:{title:TABS.telegramSessions}}}]}});
 if(action!=='ready')await sheets.spreadsheets.values.update({spreadsheetId,range:`'${TABS.telegramSessions}'!A1`,valueInputOption:'RAW',requestBody:{values:[OPS_SESSION_HEADERS]}});
 console.log(`Ops session storage: ${action}; master headers and data unchanged`);
 if(!process.argv.includes('--activate-webhook')){console.log('Staging: Telegram webhook and commands unchanged');return;}
 const token=(process.env.TELEGRAM_OPS_BOT_TOKEN??'').trim();
 const secret=(process.env.TELEGRAM_OPS_WEBHOOK_SECRET??'').trim();
 const publicUrl=new URL(process.env.OPS_PUBLIC_URL??'');
 if(!token||!secret||!/^[-_A-Za-z0-9]{32,256}$/.test(secret)||publicUrl.protocol!=='https:'||publicUrl.username||publicUrl.password)throw new Error('Dedicated Ops token, valid webhook secret and HTTPS public URL required');
 if(token===process.env.TELEGRAM_BOT_TOKEN)throw new Error('Ops token must not replace shared HR bot webhook');
 async function telegram(method:string,data:unknown={}){
  const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
  const result=await response.json();if(!response.ok||!result.ok)throw new Error(`Telegram ${method} failed; inspect bot configuration`);return result.result;
 }
 const identity=await telegram('getMe');
 const expected=process.env.TELEGRAM_OPS_BOT_USERNAME?.replace(/^@/,'');
 if(expected&&identity.username!==expected)throw new Error('Ops bot username differs from configured dashboard identity');
 await telegram('setMyCommands',{commands:OPS_COMMANDS});
 const url=new URL('/api/ops/telegram/webhook',publicUrl).href;
 await telegram('setWebhook',{url,secret_token:secret,allowed_updates:['message'],max_connections:1,drop_pending_updates:false});
 const info=await telegram('getWebhookInfo');
 if(info.url!==url||info.max_connections!==1)throw new Error('Webhook verification failed');
 console.log(JSON.stringify({bot:identity.username,webhook:info.url,maxConnections:info.max_connections,commands:OPS_COMMANDS.length,pending:info.pending_update_count}));
}
main().catch(error=>{console.error(JSON.stringify({failed:true,error:error.response?.status?`Sheets HTTP ${error.response.status}`:error instanceof Error?error.message:'Provisioning failed'}));process.exitCode=1;});
