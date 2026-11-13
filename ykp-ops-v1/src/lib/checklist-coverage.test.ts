import { describe, expect, it } from 'vitest';
import { checklistCoverage } from './checklist-coverage';
const templates = [
 { checklist_template_id:'T1',checklist_item:'Kasir',department:'Kasir',critical_flag:'false' },
 { checklist_template_id:'T2',checklist_item:'Oven',department:'Kitchen',critical_flag:'true' }
];
describe('jobdesk coverage per shift',()=>{
 it('does not mark full completion when only one department submits',()=>{
  const result=checklistCoverage(templates,[{shift_id:'S1',checklist_item:'Kasir',department:'Kasir',status:'DONE'}]);
  expect(result.percent).toBe(50);expect(result.complete).toBe(false);expect(result.criticalMissing).toBe(1);
 });
 it('combines departments and uses latest task result without duplicates',()=>{
  const result=checklistCoverage(templates,[{shift_id:'S1',checklist_item:'Kasir',department:'Kasir',status:'NOT_DONE'},{shift_id:'S1',checklist_item:'Kasir',department:'Kasir',status:'DONE'},{shift_id:'S1',checklist_item:'Oven',department:'Kitchen',status:'DONE'}]);
  expect(result.percent).toBe(100);expect(result.complete).toBe(true);
 });
 it('does not mix completions from different shifts',()=>{
  expect(checklistCoverage(templates,[{shift_id:'S1',checklist_item:'Kasir',department:'Kasir',status:'DONE'},{shift_id:'S2',checklist_item:'Oven',department:'Kitchen',status:'DONE'}]).complete).toBe(false);
 });
});
