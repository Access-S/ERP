//src/components/shared/data-table/components/data-table-faceted-filter.tsx

// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client';

import * as React from 'react';
import type { Column } from '@tanstack/react-table';
import { Check, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { DataTableRowData, Option } from '../types';

// ───────────────── BLOCK 2: Types ──────────────────────────
interface DataTableFacetedFilterProps<TData extends DataTableRowData> {
  column?: Column<TData, unknown>;
  title?: string;
  options: Option[];
  selectedValues: string[];
  onValueChange: (values: string[]) => void;
}

// ───────────────── BLOCK 3: Component ──────────────────────────
export function DataTableFacetedFilter<TData extends DataTableRowData>({
  column,
  title,
  options,
  selectedValues,
  onValueChange,
}: DataTableFacetedFilterProps<TData>) {
  const selectedSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-11 border-dashed"
          aria-label={title ? `Filter by ${title}` : 'Filter'}
        >
          <PlusCircle className="mr-2 h-4 w-4" aria-hidden="true" />
          {title}
          {selectedValues.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <div className="hidden space-x-1 lg:flex">
                {selectedValues.length > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selectedValues.length} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedSet.has(option.value))
                    .map((option) => (
                      <Badge
                        key={option.value}
                        variant="secondary"
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder={title}
            aria-label={`Search ${title}`}
            value={selectedValues.join(', ')}
            onValueChange={(value) => onValueChange(value.split(', ').filter(Boolean))}
          />
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
                      onValueChange(next);
                    }}
                  >
                    {option.icon && (
                      <option.icon className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="flex-1 text-foreground">{option.label}</span>
                    {option.count && (
                      <span className="ml-auto font-mono text-xs text-muted-foreground">
                        {option.count}
                      </span>
                    )}
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
