import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { materialItem } from '../src/lib/material-import';
import { readTab, appendRows, getSheetsClient, getSpreadsheetId, TABS, TAB_HEADERS } from '../src/db/sheets';
import { nowTimestampWib } from '../src/lib/format';

async function main(): Promise<void> {
  if (process.env.USE_MOCK_DB === 'true' || process.env.USE_POSTGRES === 'true') throw new Error('Verified Sheets backend required for this import');
  const file = process.argv.find((arg) => arg.startsWith('--input='))?.slice(8);
  if (!file) throw new Error('--input=/absolute/path/materials.json required');
  const source = JSON.parse(readFileSync(file, 'utf8')) as { brands: { name: string; aliases: string[]; rows: { line: number; name: string; weight: string; unit: string }[] }[] };
  const sheets = getSheetsClient(); const spreadsheetId = getSpreadsheetId();
  const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: [`${TABS.brands}!A:AZ`, `${TABS.items}!A:AZ`] });
  const map = (index: number) => { const [h=[],...rows] = response.data.valueRanges?.[index].values ?? []; return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(h.map((key,i)=>[key,String(r[i]??'')]))); };
  const brands = map(0); const items = map(1);
  const physicalHeaders = response.data.valueRanges?.[1].values?.[0] ?? [];
  if (JSON.stringify(physicalHeaders) !== JSON.stringify(TAB_HEADERS[TABS.items])) throw new Error('Item header differs from write schema; reconcile before import');
  const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g,'');
  const expected: Record<string,string>[] = []; const skipped: { brand: string; line: number; reason: string }[] = [];
  for (const group of source.brands) {
    const matches = brands.filter(b=>group.aliases.includes(normalize(b.brand_name)));
    if(matches.length!==1) throw new Error(`Brand missing/ambiguous: ${group.name}`);
    const unique = new Map<string,Record<string,string>>();
    for(const row of group.rows) {
      try { const item=materialItem(matches[0].brand_id,row.name,row.weight,row.unit); if(unique.has(item.item_id)) { skipped.push({brand:group.name,line:row.line,reason:'Exact duplicate'}); continue; } unique.set(item.item_id,item); }
      catch { skipped.push({brand:group.name,line:row.line,reason:'Missing or invalid weight/unit'}); }
    }
    expected.push(...unique.values()); console.log(`${group.name}: ${unique.size} valid unique items`);
  }
  const create=expected.filter(item=>{
    const matches=items.filter(old=>old.item_id===item.item_id);
    if(matches.length>1) throw new Error('Duplicate item ID');
    if(matches.length) { if(Object.entries(item).some(([key,value])=>matches[0][key]!==value)) throw new Error(`Existing item modified: ${item.item_id}`); return false; }
    if(items.some(old=>old.brand_id===item.brand_id && normalize(old.item_name)===normalize(item.item_name))) throw new Error(`Equivalent existing item: ${item.item_name}`);
    return true;
  });
  const apply=process.argv.includes('--apply');
  console.log(JSON.stringify({mode:apply?'APPLY':'DRY RUN',validUnique:expected.length,new:create.length,existing:expected.length-create.length,skipped}));
  if(!apply)return;
  mkdirSync('/tmp/material-import-backup',{recursive:true,mode:0o700});
  writeFileSync(`/tmp/material-import-backup/items-${Date.now()}.json`,JSON.stringify(response.data.valueRanges?.[1].values),{mode:0o600});
  const now=nowTimestampWib();
  if(create.length) await appendRows(TABS.items,create.map(item=>({...item,created_at:now,updated_at:now,created_by:'owner-csv-import',updated_by:'owner-csv-import'})));
  const final=await readTab<Record<string,string>>(TABS.items);
  if(!expected.every(item=>final.filter(row=>row.item_id===item.item_id).length===1))throw new Error('Post-import verification failed');
  console.log(`Verified ${expected.length} CSV items. Existing masters retained; no stock movements, prices or suppliers written.`);
}
main().catch(error=>{console.log(JSON.stringify({failed:true,message:error.response?.status?`Sheets HTTP ${error.response.status}`:error.message}));process.exitCode=1;});
