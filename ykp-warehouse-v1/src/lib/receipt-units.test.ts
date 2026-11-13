import { describe, expect, it } from 'vitest';
import { receiptToBase, mergeReceiptBatch } from './receipt-units';
describe('receipt stock valuation',()=>{
 it('converts kg to gram and reciprocal decimal HPP without changing invoice value',()=>{
  expect(receiptToBase({base_unit:'g'},'kg',2,50000,[])).toEqual({quantity:2000,unit:'g',unitCost:50,totalValue:100000});
  expect(receiptToBase({base_unit:'g'},'gram',1000,0.125,[])).toEqual({quantity:1000,unit:'g',unitCost:0.125,totalValue:125});
 });
 it('supports liter/ml, pcs aliases and configured package conversion',()=>{
  expect(receiptToBase({base_unit:'ml'},'liter',1.5,20000,[]).quantity).toBe(1500);
  expect(receiptToBase({base_unit:'pc'},'pcs',3,125.5,[]).unit).toBe('pc');
  expect(receiptToBase({item_id:'I1',base_unit:'g'},'box',2,10000,[{item_id:'I1',from_unit:'box',to_unit:'g',conversion_factor:'500',active_status:'active'}]).unitCost).toBe(20);
 });
 it('normalizes legacy batches and computes weighted unit cost',()=>{
  const incoming=receiptToBase({base_unit:'g'},'kg',1,100000,[]);
  expect(mergeReceiptBatch({base_unit:'g'},{current_qty:'2',unit:'kg',unit_cost:'50000'},incoming,[])).toEqual({quantity:3000,unit:'g',unitCost:200000/3000});
 });
 it('refuses unknown units, conflicting factors and invalid amounts',()=>{
  expect(()=>receiptToBase({base_unit:'g'},'ml',1,10,[])).toThrow();
  expect(()=>receiptToBase({base_unit:'g'},'g',NaN,10,[])).toThrow();
  expect(()=>receiptToBase({base_unit:'g'},'g',1,-1,[])).toThrow();
 });
});
