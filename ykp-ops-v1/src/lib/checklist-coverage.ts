export function checklistCoverage(templates: Record<string,string>[], rows: Record<string,string>[]) {
 const valid=rows.filter(row=>row.status!=='VOID');
 const shifts=[...new Set(valid.map(row=>row.shift_id||''))];
 if(!templates.length||!shifts.length)return {percent:0,complete:false,criticalMissing:0};
 let done=0,criticalMissing=0;
 for(const shift of shifts){
  const latest=new Map<string,Record<string,string>>();
  for(const row of valid.filter(row=>(row.shift_id||'')===shift))latest.set(JSON.stringify([row.department||'Umum',row.checklist_item]),row);
  for(const template of templates){
   const row=latest.get(JSON.stringify([template.department||'Umum',template.checklist_item]));
   if(row?.status==='DONE')done++;
   else if(template.critical_flag==='true')criticalMissing++;
  }
 }
 const total=templates.length*shifts.length;
 return {percent:Math.round(done/total*100),complete:done===total,criticalMissing};
}
