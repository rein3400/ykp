'use client';
import { useState } from 'react';
import { SearchableSelect } from '@/components/searchable-select';
export function ManualPurchaseRequest({ items, onCreated }: { items: Record<string,string>[]; onCreated: () => Promise<void> }) {
 const [lines,setLines]=useState([{item_id:'',requested_qty:'1',purchase_unit:'',estimated_unit_price:'0',reason:''}]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const update=(index:number,key:string,value:string)=>setLines(previous=>previous.map((line,i)=>i===index?{...line,[key]:value}:line));
 async function save(){
  setBusy(true);setError('');
  try {
   const response=await fetch('/api/warehouse/purchase-request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items:lines.map(line=>({...line,requested_qty:Number(line.requested_qty),estimated_unit_price:Number(line.estimated_unit_price)}))})});
   const result=await response.json();if(!response.ok)throw new Error(result.error?.message??'Gagal membuat PR');
   setLines([{item_id:'',requested_qty:'1',purchase_unit:'',estimated_unit_price:'0',reason:''}]);
   try { await onCreated(); } catch { setError('PR sudah tersimpan. Refresh daftar sebelum membuat pengajuan baru; jangan kirim ulang.'); }
  } catch(e){setError(e instanceof Error?e.message:'Koneksi gagal');}finally{setBusy(false);}
 }
 return <details className='rounded-xl border p-4'><summary className='cursor-pointer font-semibold'>Buat Purchase Request Manual</summary><p className='my-3 text-xs text-muted-foreground'>Tidak perlu menunggu critical stock. PR tetap memerlukan proses persetujuan. Harga adalah estimasi per satuan pembelian.</p>
 {lines.map((line,index)=><fieldset disabled={busy} key={index} className='mb-3 grid gap-2 rounded border p-3 sm:grid-cols-2'>
 <SearchableSelect searchLabel={`item PR baris ${index+1}`} value={line.item_id} onChange={e=>{const item=items.find(row=>row.item_id===e.target.value);setLines(previous=>previous.map((row,i)=>i===index?{...row,item_id:e.target.value,purchase_unit:item?.purchase_unit||item?.base_unit||''}:row));}}><option value=''>Pilih item</option>{items.filter(item=>item.active_status==='active').map(item=><option key={item.item_id} value={item.item_id}>{item.item_name}</option>)}</SearchableSelect>
 <label className='text-xs'>Qty diminta<input aria-label={`Qty PR ${index+1}`} className='block w-full rounded border p-2' type='number' step='any' min='0' value={line.requested_qty} onChange={e=>update(index,'requested_qty',e.target.value)}/></label>
 <label className='text-xs'>Satuan pembelian<input className='block w-full rounded border p-2' value={line.purchase_unit} onChange={e=>update(index,'purchase_unit',e.target.value)}/></label>
 <label className='text-xs'>Estimasi harga satuan<input className='block w-full rounded border p-2' type='number' step='any' min='0' value={line.estimated_unit_price} onChange={e=>update(index,'estimated_unit_price',e.target.value)}/></label>
 <label className='text-xs'>Alasan<input className='block w-full rounded border p-2' value={line.reason} onChange={e=>update(index,'reason',e.target.value)}/></label>
 {lines.length>1&&<button type='button' onClick={()=>setLines(previous=>previous.filter((_,i)=>i!==index))}>Hapus baris</button>}
 </fieldset>)}
 <div className='flex gap-3'><button type='button' disabled={busy} onClick={()=>setLines([...lines,{item_id:'',requested_qty:'1',purchase_unit:'',estimated_unit_price:'0',reason:''}])}>+ Item</button><button type='button' disabled={busy||lines.some(line=>!line.item_id||!line.purchase_unit||!Number.isFinite(Number(line.requested_qty))||Number(line.requested_qty)<=0||!Number.isFinite(Number(line.estimated_unit_price))||Number(line.estimated_unit_price)<0)} onClick={save} className='rounded bg-primary px-3 py-2 text-primary-foreground'>{busy?'Menyimpan…':'Ajukan PR Manual'}</button></div>{error&&<p role='alert' className='mt-2 text-red-700'>{error}</p>}
 </details>;
}
