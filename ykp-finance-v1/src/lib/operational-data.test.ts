import { describe, expect, it } from 'vitest';
import { activeOutlets, operationalRows } from './operational-data';

const outlets = [
  { outlet_id: 'OL-1', status: 'active' },
  { outlet_id: 'OL-2', status: 'inactive' },
  { outlet_id: 'OL-3', status: ' 1 ' }
];

describe('operational outlet scope', () => {
  it('offers active outlets only, including normalized legacy active status', () => {
    expect(activeOutlets(outlets).map((row) => row.outlet_id)).toEqual(['OL-1', 'OL-3']);
  });
  it('excludes inactive operational rows but retains global rows and original history', () => {
    const rows = [{ outlet_id: 'OL-1' }, { outlet_id: 'OL-2' }, { outlet_id: '' }];
    expect(operationalRows(rows, outlets)).toEqual([rows[0], rows[2]]);
    expect(rows).toHaveLength(3);
  });
});
