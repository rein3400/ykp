import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SearchableSelect, selectOptions } from './searchable-select';
const children = [
 React.createElement('option', { key: 'empty', value: '' }, 'Pilih Item'),
 React.createElement('option', { key: 'z', value: 'ID1' }, 'Zaitun'),
 React.createElement('option', { key: 'a', value: 'ID9' }, 'Ayam'),
 React.createElement('option', { key: 'b', value: 'ID3', disabled: true }, 'Beras')
];
describe('searchable entity select', () => {
 it('sorts labels A–Z without mutating values or children and keeps empty first', () => {
  expect(selectOptions(children, '', 'ID1').options.map(o => o.props.value)).toEqual(['', 'ID9', 'ID3', 'ID1']);
  expect(children[1].props.value).toBe('ID1');
 });
 it('searches labels and IDs case-insensitively while retaining the selection', () => {
  const result = selectOptions(children, ' ayam ', 'ID1');
  expect(result.matches).toBe(1);
  expect(result.options.map(o => o.props.value)).toEqual(['', 'ID9', 'ID1']);
  expect(selectOptions(children, 'id3', '').options.map(o => o.props.value)).toEqual(['', 'ID3']);
 });
 it('does not clear selected value when no result matches or choices change', () => {
  const result = selectOptions(children, 'missing', 'ID1');
  expect(result.matches).toBe(0);
  expect(result.options.map(o => o.props.value)).toEqual(['', 'ID1']);
 });
 it('renders labeled search plus native select preserving name, disabled, required and selected value', () => {
  const html = renderToStaticMarkup(React.createElement(SearchableSelect, { value: 'ID1', onChange: () => undefined, name: 'item_id', disabled: true, required: true, searchLabel: 'Item bahan' }, children));
  expect(html).toContain('type="search"');
  expect(html).toContain('aria-label="Cari Item bahan"');
  expect(html).toContain('name="item_id"');
  expect(html).toContain('required=""');
  expect(html).toContain('value="ID1" selected=""');
  expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
 });
 it('supports fragmented option labels and numeric sorting of displayed names', () => {
  const nodes = React.createElement(React.Fragment, null,
    React.createElement('option', { value: 'B' }, 'Bahan ', 10),
    React.createElement('option', { value: 'A' }, 'Bahan ', 2));
  expect(selectOptions(nodes, 'bahan 2', '').options.map(o => o.props.value)).toEqual(['A']);
 });
});
