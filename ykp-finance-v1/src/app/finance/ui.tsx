'use client';
/**
 * Shared UI primitives for YKP Finance pages (sibling-convention styling).
 */
import React, { useId } from 'react';

export function rp(n: number | string | null | undefined): string {
  const num = typeof n === 'string' ? Number(n) : n;
  if (num === null || num === undefined || !Number.isFinite(num)) return 'Rp 0';
  const sign = num < 0 ? '-' : '';
  return `${sign}Rp ${Math.abs(Math.trunc(num)).toLocaleString('id-ID')}`;
}

export function rpSigned(n: number | string | null | undefined): string {
  const num = typeof n === 'string' ? Number(n) : n;
  if (num === null || num === undefined || !Number.isFinite(num)) return 'Rp 0';
  return num > 0 ? `+${rp(num)}` : rp(num);
}

export function Kpi({ label, value, sub, tone }: {
  label: string; value: string; sub?: string;
  tone?: 'default' | 'good' | 'bad' | 'warn';
}) {
  const color = tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : '';
  return (
    <div className='rounded border border-border bg-background p-3'>
      <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>{label}</p>
      <p className={`mt-1 text-lg font-bold leading-tight ${color}`}>{value}</p>
      {sub && <p className='mt-0.5 text-[10px] text-muted-foreground'>{sub}</p>}
    </div>
  );
}

export function Card({ title, sub, children, action }: {
  title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className='rounded border border-border bg-background p-3'>
      <div className='mb-2 flex items-start justify-between gap-2'>
        <div>
          <p className='text-xs font-semibold'>{title}</p>
          {sub && <p className='text-[10px] text-muted-foreground'>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ message, ctaLabel, onCta, cta2Label, onCta2 }: {
  message: string; ctaLabel?: string; onCta?: () => void; cta2Label?: string; onCta2?: () => void;
}) {
  return (
    <div className='rounded border border-dashed border-border p-6 text-center'>
      <p className='text-xs text-muted-foreground whitespace-pre-line'>{message}</p>
      {(ctaLabel || cta2Label) && (
        <div className='mt-3 flex justify-center gap-2'>
          {ctaLabel && <Btn onClick={onCta}>{ctaLabel}</Btn>}
          {cta2Label && <Btn variant='outline' onClick={onCta2}>{cta2Label}</Btn>}
        </div>
      )}
    </div>
  );
}

export function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`px-2 py-1 ${right ? 'text-right' : 'text-left'} font-medium`}>{children}</th>;
}

export function Td({ children, right, muted, bold }: {
  children?: React.ReactNode; right?: boolean; muted?: boolean; bold?: boolean;
}) {
  return (
    <td className={`px-2 py-1 ${right ? 'text-right' : ''} ${muted ? 'text-muted-foreground' : ''} ${bold ? 'font-medium' : ''}`}>
      {children}
    </td>
  );
}

const BADGE_STYLES: Record<string, string> = {
  // payment status
  PAID: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-blue-100 text-blue-800',
  UNPAID: 'bg-amber-100 text-amber-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
  // approval status
  APPROVED: 'bg-green-100 text-green-800',
  PENDING: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-red-100 text-red-800',
  DRAFT: 'bg-gray-100 text-gray-600',
  // severity
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-red-100 text-red-800',
  CRITICAL: 'bg-red-600 text-white',
  // action status
  OPEN: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  WAITING_APPROVAL: 'bg-amber-100 text-amber-800',
  DONE: 'bg-green-100 text-green-800',
  ACTIVE: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
  MISMATCH: 'bg-red-100 text-red-800',
  OK: 'bg-green-100 text-green-800'
};

export function Badge({ value }: { value: string }) {
  const v = (value ?? '').toUpperCase();
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${BADGE_STYLES[v] ?? 'bg-gray-100 text-gray-600'}`}>
      {value || '-'}
    </span>
  );
}

export function Btn({ children, onClick, variant, disabled, type }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: 'primary' | 'outline' | 'danger' | 'ghost';
  disabled?: boolean; type?: 'button' | 'submit';
}) {
  const cls = variant === 'outline'
    ? 'border border-border text-foreground hover:bg-muted'
    : variant === 'danger'
      ? 'bg-destructive text-destructive-foreground'
      : variant === 'ghost'
        ? 'text-muted-foreground hover:bg-muted'
        : 'bg-primary text-primary-foreground';
  return (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, id, ...rest } = props;
  const auto = useId();
  const fid = id ?? `fin-${auto}`;
  return (
    <div>
      <label htmlFor={fid} className='mb-1 block text-[10px] font-medium text-muted-foreground'>{label}</label>
      <input id={fid} {...rest} className='w-full rounded border border-border px-2 py-1.5 text-xs' />
    </div>
  );
}

export function Select({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  const fid = useId();
  return (
    <div>
      <label htmlFor={`fin-${fid}`} className='mb-1 block text-[10px] font-medium text-muted-foreground'>{label}</label>
      <select
        id={`fin-${fid}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='w-full rounded border border-border px-2 py-1.5 text-xs bg-background'
      >
        {children}
      </select>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4' onClick={onClose}>
      <div
        className={`max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-background p-4 shadow-lg ${wide ? 'w-full max-w-3xl' : 'w-full max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='mb-3 flex items-center justify-between'>
          <p className='text-sm font-semibold'>{title}</p>
          <button onClick={onClose} className='text-muted-foreground hover:text-foreground text-lg leading-none'>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export interface FilterState {
  brandId: string;
  outletId: string;
  from: string;
  to: string;
}

export function FilterBar({
  brands, outlets, value, onChange, extra
}: {
  brands: Record<string, string>[];
  outlets: Record<string, string>[];
  value: FilterState;
  onChange: (v: FilterState) => void;
  extra?: React.ReactNode;
}) {
  const scopedOutlets = value.brandId ? outlets.filter((o) => o.brand_id === value.brandId) : outlets;
  return (
    <div className='flex flex-wrap items-end gap-2 rounded border border-border bg-background p-2'>
      <div className='w-36'>
        <Select label='Brand' value={value.brandId} onChange={(v) => onChange({ ...value, brandId: v, outletId: '' })}>
          <option value=''>Semua Brand</option>
          {brands.map((b) => <option key={b.brand_id} value={b.brand_id}>{b.brand_name}</option>)}
        </Select>
      </div>
      <div className='w-44'>
        <Select label='Outlet' value={value.outletId} onChange={(v) => onChange({ ...value, outletId: v })}>
          <option value=''>Semua Outlet</option>
          {scopedOutlets.map((o) => <option key={o.outlet_id} value={o.outlet_id}>{o.outlet_name}</option>)}
        </Select>
      </div>
      <div className='w-36'>
        <Input label='Dari Tanggal' type='date' value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
      </div>
      <div className='w-36'>
        <Input label='Sampai Tanggal' type='date' value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
      </div>
      {extra}
    </div>
  );
}

/** Simple horizontal bar chart (no chart lib, sibling-style). */
export function Bars({ data, format }: {
  data: { label: string; value: number; title?: string }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const fmt = format ?? ((n: number) => String(n));
  return (
    <div className='space-y-1'>
      {data.map((d, i) => (
        <div key={i} className='flex items-center gap-2 text-[10px]'>
          <span className='w-20 truncate text-muted-foreground' title={d.title ?? d.label}>{d.label}</span>
          <div className='flex-1 h-3 rounded bg-muted overflow-hidden'>
            <div
              className={`h-full ${d.value < 0 ? 'bg-red-400' : 'bg-primary/70'}`}
              style={{ width: `${Math.min(100, (Math.abs(d.value) / max) * 100)}%` }}
            />
          </div>
          <span className='w-24 text-right font-medium'>{fmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}
