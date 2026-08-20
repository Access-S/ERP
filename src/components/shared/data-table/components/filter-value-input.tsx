// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { DatePicker } from '@/components/shared/date-picker';
import type { CalendarValue } from '@/types/calendar';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { DataTableRangeFilter } from './data-table-range-filter';
import type { FilterOperator, FilterVariant, Option } from '../types';

// ───────────────── BLOCK 2: Types ──────────────────────────────
interface FilterValueInputProps {
  /** Current filter value — shape depends on variant/operator */
  value: unknown;
  /** Which filter variant to render */
  variant: FilterVariant;
  /** Current filter operator — affects rendering (e.g., isBetween shows range) */
  operator: FilterOperator;
  /** Column meta for placeholder, options, range, etc. */
  meta?: {
    label?: string;
    variant?: FilterVariant;
    placeholder?: string;
    options?: Option[];
    range?: [number, number];
    unit?: string;
    icon?: React.ComponentType<React.ComponentProps<'svg'>>;
  };
  /** Called when the user changes the value */
  onChange: (value: unknown) => void;
}

// ───────────────── BLOCK 3: Date Conversion Helpers ───────────
/**
 * Convert our filter value format to CalendarValue for the DatePicker.
 * Our format: undefined | string (timestamp) | [string, string] (timestamps)
 * CalendarValue: undefined | Date | { from: Date, to?: Date }
 */
function filterValueToCalendarValue(
  value: unknown,
  isRange: boolean
): CalendarValue {
  if (value === undefined || value === null) return undefined;

  if (isRange) {
    const timestamps = Array.isArray(value) ? value : [value, value];
    const from = timestamps[0] ? new Date(Number(timestamps[0])) : undefined;
    const to = timestamps[1] ? new Date(Number(timestamps[1])) : undefined;
    if (from) return { from, to };
    return undefined;
  }

  // Single date
  if (typeof value === 'string' && value) {
    return new Date(Number(value));
  }
  if (typeof value === 'number') {
    return new Date(value);
  }
  return undefined;
}

/**
 * Convert CalendarValue back to our filter value format.
 */
function calendarValueToFilterValue(
  calendarValue: CalendarValue | undefined,
  isRange: boolean
): unknown {
  if (!calendarValue) return undefined;

  if (isRange && typeof calendarValue === 'object' && 'from' in calendarValue) {
    const { from, to } = calendarValue;
    if (from) {
      return [
        from.getTime().toString(),
        to ? to.getTime().toString() : '',
      ];
    }
    return undefined;
  }

  if (calendarValue instanceof Date) {
    return calendarValue.getTime().toString();
  }

  return undefined;
}

// ───────────────── BLOCK 4: Component ──────────────────────────
export function FilterValueInput({
  value,
  variant,
  operator,
  meta,
  onChange,
}: FilterValueInputProps) {
  // ── isEmpty / isNotEmpty: no value input needed ──
  if (operator === 'isEmpty' || operator === 'isNotEmpty') {
    return (
      <div
        role="status"
        aria-label={`Filter is ${operator === 'isEmpty' ? 'empty' : 'not empty'}`}
        aria-live="polite"
        className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground"
      >
        {operator === 'isEmpty' ? 'Is empty' : 'Is not empty'}
      </div>
    );
  }

  // ── Variant switch ──
  switch (variant) {
    // ── Text ──
    case 'text':
      return (
        <Input
          type="text"
          aria-label={`${meta?.label ?? 'Text'} filter value`}
          placeholder={meta?.placeholder ?? 'Enter a value...'}
          className="h-11 w-full"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );

    // ── Number ──
    case 'number':
      return (
        <Input
          type="number"
          inputMode="numeric"
          aria-label={`${meta?.label ?? 'Number'} filter value`}
          placeholder={meta?.placeholder ?? 'Enter a value...'}
          className="h-11 w-full"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );

    // ── Range (single value or isBetween) ──
    case 'range': {
      if (operator === 'isBetween') {
        const rangeValue: [string, string] = Array.isArray(value)
          ? [String(value[0] ?? ''), String(value[1] ?? '')]
          : [typeof value === 'string' ? value : '', ''];

        return (
          <DataTableRangeFilter
            value={rangeValue}
            min={meta?.range?.[0]}
            max={meta?.range?.[1]}
            onChange={(v) => {
              const hasValue = v[0] || v[1];
              onChange(hasValue ? v : undefined);
            }}
          />
        );
      }

      return (
        <Input
          type="number"
          inputMode="numeric"
          aria-label={`${meta?.label ?? 'Range'} filter value`}
          placeholder={meta?.placeholder ?? 'Enter a value...'}
          className="h-11 w-full"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );
    }

    // ── Boolean ──
    case 'boolean': {
      const boolValue = typeof value === 'string' ? value : 'true';

      return (
        <Select value={boolValue} onValueChange={(v) => onChange(v)}>
          <SelectTrigger
            aria-label={`${meta?.label ?? 'Boolean'} filter`}
            className="h-11 w-full"
          >
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      );
    }

    // ── Select (single) ──
    case 'select': {
      const options: Option[] = meta?.options ?? [];
      const currentValue = typeof value === 'string' ? value : undefined;

      return (
        <Select value={currentValue} onValueChange={(v) => onChange(v)}>
          <SelectTrigger
            aria-label={`${meta?.label ?? 'Select'} filter`}
            className="h-11 w-full"
          >
            <SelectValue placeholder={meta?.placeholder ?? 'Select option...'} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.icon && (
                    <option.icon className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      );
    }

    // ── Multi-Select ──
    case 'multiSelect': {
      const options: Option[] = meta?.options ?? [];
      const selectedValues: string[] = Array.isArray(value)
        ? value.map(String)
        : value
          ? [String(value)]
          : [];

      return (
        <MultiSelectInput
          options={options}
          selectedValues={selectedValues}
          placeholder={meta?.placeholder ?? 'Select options...'}
          ariaLabel={`${meta?.label ?? 'Multi-select'} filter values`}
          onChange={(v) => onChange(v.length > 0 ? v : undefined)}
        />
      );
    }

    // ── Date ──
    case 'date':
    case 'dateRange': {
      const isRange = operator === 'isBetween' || variant === 'dateRange';
      const calendarValue = filterValueToCalendarValue(value, isRange);

      return (
        <DatePicker
          value={calendarValue}
          selectionMode={isRange ? 'range' : 'single'}
          placeholder={meta?.placeholder ?? 'Pick a date'}
          onChange={(newCalendarValue) => {
            onChange(calendarValueToFilterValue(newCalendarValue, isRange));
          }}
        />
      );
    }

    default:
      return null;
  }
}

// ───────────────── BLOCK 5: Multi-Select Sub-Component ────────
interface MultiSelectInputProps {
  options: Option[];
  selectedValues: string[];
  placeholder: string;
  ariaLabel: string;
  onChange: (value: string[]) => void;
}

function MultiSelectInput({
  options,
  selectedValues,
  placeholder,
  ariaLabel,
  onChange,
}: MultiSelectInputProps) {
  const [open, setOpen] = React.useState(false);
  const selectedSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={ariaLabel}
          className="h-11 w-full justify-start font-normal"
        >
          {selectedValues.length === 0 ? (
            placeholder
          ) : (
            `${selectedValues.length} selected`
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search options..." />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      const next = isSelected
                        ? selectedValues.filter((v) => v !== option.value)
                        : [...selectedValues, option.value];
                      onChange(next);
                    }}
                  >
                    {option.icon && (
                      <option.icon className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{option.label}</span>
                    {isSelected && (
                      <Check className="ml-auto h-4 w-4" aria-hidden="true" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}