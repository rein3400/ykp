"use client";

import * as React from "react";
import { Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { cn } from '../lib/utils';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterBarProps {
  /** Brand dropdown options. Pass `[]` and `disabled` to hide brands. */
  brands?: FilterOption[];
  /** Outlet dropdown options. */
  outlets?: FilterOption[];
  /** Periode dropdown options (e.g. Hari Ini / Bulan Ini / Custom). */
  periodes?: FilterOption[];
  /** Shift dropdown options (e.g. Pagi / Sore / Malam). */
  shifts?: FilterOption[];
  /** Called whenever any filter value changes; receives all current values. */
  onChange?: (filters: FilterBarValue) => void;
  className?: string;
}

export interface FilterBarValue {
  brand: string;
  outlet: string;
  periode: string;
  shift: string;
}

const ALL = "ALL";

/**
 * Brand / Outlet / Periode / Shift filter bar for ERP dashboards.
 * Every dropdown defaults to "Semua" and emits an ALL-suffixed value
 * when nothing is picked.
 */
export function FilterBar({
  brands = [],
  outlets = [],
  periodes = [],
  shifts = [],
  onChange,
  className,
}: FilterBarProps) {
  const [value, setValue] = React.useState<FilterBarValue>({
    brand: ALL,
    outlet: ALL,
    periode: ALL,
    shift: ALL,
  });

  const update = React.useCallback(
    (key: keyof FilterBarValue, next: string) => {
      setValue((prev) => {
        const merged = { ...prev, [key]: next };
        onChange?.(merged);
        return merged;
      });
    },
    [onChange],
  );

  const renderSelect = (
    key: keyof FilterBarValue,
    placeholder: string,
    options: FilterOption[],
  ) => {
    if (!options.length) return null;
    return (
      <Select value={value[key]} onValueChange={(v) => update(key, v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Semua</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filter</span>
      </div>
      {renderSelect("brand", "Brand", brands)}
      {renderSelect("outlet", "Outlet", outlets)}
      {renderSelect("periode", "Periode", periodes)}
      {renderSelect("shift", "Shift", shifts)}
    </div>
  );
}