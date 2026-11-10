'use client';
import { Children, Fragment, isValidElement, useId, useState, type ReactElement, type ReactNode, type SelectHTMLAttributes, type OptionHTMLAttributes } from 'react';

type Option = ReactElement<OptionHTMLAttributes<HTMLOptionElement>>;
function textOf(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<{ children?: ReactNode }>(child) ? textOf(child.props.children) : String(child)).join('');
}
function optionsOf(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [];
    if (child.type === Fragment) return optionsOf(child.props.children);
    if (child.type !== 'option') throw new Error('SearchableSelect requires option elements');
    return [child as Option];
  });
}
export function selectOptions(children: ReactNode, query: string, value: string) {
  const all = optionsOf(children);
  const normalized = query.trim().toLocaleLowerCase('id');
  const match = (option: Option) => `${textOf(option.props.children)} ${option.props.value ?? ''}`.toLocaleLowerCase('id').includes(normalized);
  const placeholders = all.filter(o => String(o.props.value ?? '') === '');
  const options = all.filter(o => String(o.props.value ?? '') !== '').sort((a, b) => textOf(a.props.children).localeCompare(textOf(b.props.children), 'id', { sensitivity: 'base', numeric: true }));
  return {
    options: [...placeholders, ...options.filter(o => match(o) || String(o.props.value) === value)],
    matches: options.filter(match).length
  };
}
export function SearchableSelect({ children, searchLabel = 'pilihan', className, value, onChange, disabled, ...props }: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'multiple' | 'defaultValue'> & { searchLabel?: string }) {
  const [query, setQuery] = useState('');
  const id = useId();
  const selection = value === undefined ? '' : String(value);
  const result = selectOptions(children, query, selection);
  return <span className='flex min-w-0 flex-col gap-1'>
    <input type='search' aria-label={`Cari ${searchLabel}`} aria-controls={props.id ?? `${id}-select`} disabled={disabled} value={query} onChange={event => setQuery(event.target.value)} placeholder={`Cari ${searchLabel}…`} className='w-full min-w-0 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50' />
    <select {...props} id={props.id ?? `${id}-select`} aria-label={props['aria-label'] ?? searchLabel} disabled={disabled} className={`w-full min-w-0 ${className ?? ''}`} value={value} onChange={event => { onChange?.(event); setQuery(''); }}>
      {result.options}
    </select>
    {query.trim() && <span role='status' className='text-[10px] text-muted-foreground'>{result.matches ? `${result.matches} hasil pencarian` : 'Tidak ada hasil. Pilihan sebelumnya tetap dipertahankan.'}</span>}
  </span>;
}
