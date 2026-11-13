import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ManualPurchaseRequest } from './manual-pr';
describe('manual PR form',()=>{
 it('does not require recommendations and exposes item qty unit and price',()=>{
  const html=renderToStaticMarkup(React.createElement(ManualPurchaseRequest,{items:[],onCreated:async()=>undefined}));
  expect(html).toContain('Ajukan PR Manual');expect(html).toContain('Qty diminta');expect(html).toContain('Satuan pembelian');expect(html).toContain('Estimasi harga satuan');
 });
});
