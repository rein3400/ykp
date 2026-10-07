import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FilterBar } from './ui';

describe('operational Finance filter choices', () => {
  it('omits inactive outlets while enforcing the selected brand', () => {
    const html = renderToStaticMarkup(React.createElement(FilterBar, {
      brands: [],
      outlets: [
        { outlet_id: 'A', outlet_name: 'Active outlet', brand_id: 'BR1', status: 'active' },
        { outlet_id: 'B', outlet_name: 'Dummy inactive', brand_id: 'BR1', status: 'inactive' },
        { outlet_id: 'C', outlet_name: 'Other brand', brand_id: 'BR2', status: 'active' }
      ],
      value: { brandId: 'BR1', outletId: '', from: '', to: '' }, onChange: () => undefined
    }));
    expect(html).toContain('Active outlet');
    expect(html).not.toContain('Dummy inactive');
    expect(html).not.toContain('Other brand');
  });
});
