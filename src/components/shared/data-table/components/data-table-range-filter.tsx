// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ───────────────── BLOCK 2: Types ──────────────────────────────
interface DataTableRangeFilterProps {
  /** Current values as strings: [min, max] */
  value: [string, string];
  /** Allowed minimum (for placeholder and validation) */
  min?: number;
  /** Allowed maximum (for placeholder and validation) */
  max?: number;
  /** Called when either input changes */
  onChange: (value: [string, string]) => void;
  /** Additional CSS classes */
  className?: string;
}

// ───────────────── BLOCK 3: Component ──────────────────────────
export function DataTableRangeFilter({
  value,
  min,
  max,
  onChange,
  className,
}: DataTableRangeFilterProps) {
  const onValueChange = React.useCallback(
    (inputValue: string, isMin: boolean) => {
      const numValue = Number(inputValue);
      const otherValue = isMin ? value[1] : value[0];
      const otherNum = Number(otherValue) || 0;

      // Allow empty input (user is clearing)
      if (inputValue === '') {
        onChange(isMin ? [inputValue, otherValue] : [otherValue, inputValue]);
        return;
      }

      if (Number.isNaN(numValue)) return;

      // Basic validation: min <= max
      const effectiveMin = min ?? 0;
      const effectiveMax = max ?? 999999;
      if (isMin && numValue > (otherNum || effectiveMax)) return;
      if (!isMin && numValue < (otherNum || effectiveMin)) return;

      onChange(isMin ? [inputValue, otherValue] : [otherValue, inputValue]);
    },
    [value, min, max, onChange]
  );

  return (
    <div
      data-slot="range"
      className={cn('flex w-full items-center gap-2', className)}
    >
      <Input
        type="number"
        inputMode="numeric"
        aria-label="Minimum value"
        placeholder={min?.toString() ?? 'Min'}
        min={min}
        max={max}
        className="h-11 w-full"
        value={value[0]}
        onChange={(e) => onValueChange(e.target.value, true)}
      />
      <span className="shrink-0 text-sm text-muted-foreground" aria-hidden="true">
        to
      </span>
      <Input
        type="number"
        inputMode="numeric"
        aria-label="Maximum value"
        placeholder={max?.toString() ?? 'Max'}
        min={min}
        max={max}
        className="h-11 w-full"
        value={value[1]}
        onChange={(e) => onValueChange(e.target.value, false)}
      />
    </div>
  );
}