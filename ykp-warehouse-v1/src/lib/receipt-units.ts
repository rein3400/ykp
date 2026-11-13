import { fixedConversionFactor, normalizeUnit } from './unit-conversion';
export function mergeReceiptBatch(item:Record<string,string>,batch:Record<string,string>,incoming:ReturnType<typeof receiptToBase>,rules:Record<string,string>[]){
 const old=receiptToBase(item,batch.unit,Number(batch.current_qty),Number(batch.unit_cost),rules);
 const quantity=old.quantity+incoming.quantity;
 if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Saldo batch tidak valid');
 const unitCost=(old.quantity*old.unitCost+incoming.quantity*incoming.unitCost)/quantity;
 if(!Number.isFinite(unitCost))throw new Error('HPP batch tidak valid');
 return {quantity,unit:incoming.unit,unitCost};
}
export function receiptToBase(item:Record<string,string>,rawUnit:string,qty:number,price:number,rules:Record<string,string>[]){
 if(!Number.isFinite(qty)||qty<0||!Number.isFinite(price)||price<0)throw new Error('Qty/harga wajib finite dan nonnegatif');
 const alias=(value:string)=>['pcs','piece','pieces'].includes(value.trim().toLowerCase())?'pc':normalizeUnit(value);
 const from=alias(rawUnit),unit=alias(item.base_unit??'');
 if(!from||!unit)throw new Error('Satuan dasar item wajib valid');
 let factor=from===unit?1:fixedConversionFactor(from,unit);
 if(factor===null){
  const matches=rules.filter(r=>r.item_id===item.item_id&&r.active_status==='active'&&alias(r.from_unit??'')===from&&alias(r.to_unit??'')===unit);
  if(matches.length!==1)throw new Error('Konversi satuan belum tersedia atau ambigu; konfigurasikan Unit Conversion');
  factor=Number(matches[0].conversion_factor);
 }
 if(!Number.isFinite(factor)||factor<=0)throw new Error('Faktor konversi tidak valid');
 const quantity=qty*factor,unitCost=price/factor,totalValue=Math.round(qty*price);
 if(!Number.isFinite(quantity)||!Number.isFinite(unitCost)||!Number.isSafeInteger(totalValue))throw new Error('Nilai penerimaan di luar batas aman');
 return {quantity,unit,unitCost,totalValue};
}
