//src/components/shared/data-table/components/data-table-filter-list.tsx

// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronDown, ListFilter, Plus, Trash2, X } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FilterValueInput } from './filter-value-input';
import { getFilterOperators, getDefaultFilterOperator } from '../lib/utils';
import type { DataTableRowData, FilterItem, FilterOperator, FilterVariant } from '../types';

// ───────────────── BLOCK 2: Types ────────────────────────────
interface DataTableFilterListProps<TData extends DataTableRowData> {
  columns: ColumnDef<TData>[];
  filters: FilterItem[];
  onFilterChange: (filter: FilterItem) => void;
  onFilterRemove: (columnId: string) => void;
  onFiltersClear: () => void;
}

interface FilterRowProps<TData extends DataTableRowData> {
  filter: FilterItem;
  columns: ColumnDef<TData>[];
  filteredColumnIds: Set<string>;
  onFilterChange: (filter: FilterItem) => void;
  onFilterRemove: (columnId: string) => void;
}

interface ColumnSelectorProps<TData extends DataTableRowData> {
  currentColumnId: string;
  columns: ColumnDef<TData>[];
  filteredColumnIds: Set<string>;
  onSelect: (columnId: string) => void;
}

// ───────────────── BLOCK 3: Constants ──────────────────────────
const REMOVE_FILTER_SHORTCUTS = ['backspace', 'delete'] as const;

// ───────────────── BLOCK 4: Main Component ─────────────────────
export function DataTableFilterList<TData extends DataTableRowData>({
  columns,
  filters,
  onFilterChange,
  onFilterRemove,
  onFiltersClear,
}: DataTableFilterListProps<TData>) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const filterableColumns = React.useMemo(
    () => columns.filter((col) => col.enableColumnFilter !== false),
    [columns]
  );

  const filteredColumnIds = React.useMemo(
    () => new Set(filters.map((f) => f.id)),
    [filters]
  );

  const availableColumns = React.useMemo(
    () =>
      filterableColumns.filter(
        (col) => col.id && !filteredColumnIds.has(col.id) // FIX: Added col.id && to prevent passing undefined to .has()
      ),
    [filterableColumns, filteredColumnIds]
  );

  const onAddFilter = React.useCallback(() => {
    const column = availableColumns[0];
    if (!column?.id) return;
    const variant: FilterVariant = column.meta?.variant ?? 'text';
    const operator: FilterOperator = getDefaultFilterOperator(variant);
    onFilterChange({ id: column.id, operator, value: undefined });
  }, [availableColumns, onFilterChange]);

  const onListKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (
        REMOVE_FILTER_SHORTCUTS.includes(event.key as (typeof REMOVE_FILTER_SHORTCUTS)[number]) &&
        filters.length > 0
      ) {
        event.preventDefault();
        onFilterRemove(filters[filters.length - 1].id);
      }
    },
    [filters, onFilterRemove]
  );

  const onTriggerKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (
        REMOVE_FILTER_SHORTCUTS.includes(event.key as (typeof REMOVE_FILTER_SHORTCUTS)[number]) &&
        filters.length > 0
      ) {
        event.preventDefault();
        onFilterRemove(filters[filters.length - 1].id);
      }
    },
    [filters, onFilterRemove]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-11 font-normal"
          ref={triggerRef}
          onKeyDown={onTriggerKeyDown}
        >
          <ListFilter className="text-muted-foreground" />
          Filter
          {filters.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {filters.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="flex w-full max-w-(--radix-popover-content-available-width) flex-col gap-3 p-4 sm:min-w-[420px]"
      >
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-medium leading-none">
            {filters.length > 0 ? 'Filters' : 'No filters applied'}
          </h4>
          {filters.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Modify filters to refine your rows.
            </p>
          )}
        </div>

        {filters.length > 0 && (
          <div
            ref={listRef}
            role="list"
            aria-label="Active filters"
            className="flex max-h-[300px] flex-col gap-2 overflow-y-auto p-1"
            onKeyDown={onListKeyDown}
          >
            {filters.map((filter) => (
              <FilterRow
                key={filter.id}
                filter={filter}
                columns={filterableColumns}
                filteredColumnIds={filteredColumnIds}
                onFilterChange={onFilterChange}
                onFilterRemove={onFilterRemove}
              />
            ))}
          </div>
        )}

        <div className="flex w-full items-center gap-2">
          <Button
            className="h-11"
            onClick={onAddFilter}
            disabled={availableColumns.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add filter
          </Button>
          {filters.length > 0 && (
            <Button
              variant="outline"
              className="h-11"
              onClick={onFiltersClear}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Reset filters
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ───────────────── BLOCK 5: Filter Row ────────────────────────
function FilterRow<TData extends DataTableRowData>({
  filter,
  columns,
  filteredColumnIds,
  onFilterChange,
  onFilterRemove,
}: FilterRowProps<TData>) {
  const column = columns.find((c) => c.id === filter.id);

  // FIX: Moved null check to the top so `column.id` is safely narrowed to `string` below
  if (!column?.id) return null;

  const meta = column.meta;
  const variant: FilterVariant = meta?.variant ?? 'text';
  const operators = getFilterOperators(variant);

  const onValueChange = React.useCallback(
    (value: unknown) => {
      onFilterChange({ ...filter, value });
    },
    [filter, onFilterChange]
  );

  const onOperatorChange = React.useCallback(
    (operator: FilterOperator) => {
      const clearValue =
        operator === 'isEmpty' || operator === 'isNotEmpty'
          ? undefined
          : filter.value;
      onFilterChange({ ...filter, operator, value: clearValue });
    },
    [filter, onFilterChange]
  );

  return (
    <div
      role="listitem"
      className="flex items-center gap-2"
    >
      <ColumnSelector
        currentColumnId={column.id}
        columns={columns}
        filteredColumnIds={filteredColumnIds}
        onSelect={(newColumnId) => {
          if (newColumnId === column.id) return;
          const newColumn = columns.find((c) => c.id === newColumnId);
          if (!newColumn?.id) return;
          const newVariant: FilterVariant = newColumn.meta?.variant ?? 'text';
          const newOperator: FilterOperator = getDefaultFilterOperator(newVariant);
          onFilterChange({
            id: newColumnId,
            operator: newOperator,
            value: undefined,
          });
        }}
      />
      <Select
        value={filter.operator}
        onValueChange={onOperatorChange}
      >
        <SelectTrigger
          aria-label={`${meta?.label ?? column.id} filter operator`}
          className="h-11 w-[130px] lowercase"
        >
          <SelectValue placeholder="Operator" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {operators.map((op) => (
              <SelectItem key={op.value} value={op.value} className="lowercase">
                {op.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className="min-w-[150px] flex-1">
        <FilterValueInput
          value={filter.value}
          variant={variant}
          operator={filter.operator}
          meta={meta}
          onChange={onValueChange}
        />
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-11 w-11 shrink-0"
        aria-label={`Remove ${meta?.label ?? column.id} filter`}
        onClick={() => onFilterRemove(filter.id)}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

// ───────────────── BLOCK 6: Column Selector ──────────────────
function ColumnSelector<TData extends DataTableRowData>({
  currentColumnId,
  columns,
  filteredColumnIds,
  onSelect,
}: ColumnSelectorProps<TData>) {
  const [selectorOpen, setSelectorOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  const column = columns.find((c) => c.id === currentColumnId);
  const label = column?.meta?.label ?? currentColumnId;

  const selectableColumns = React.useMemo(
    () =>
      columns.filter(
        (col) =>
          col.id && // FIX: Ensure col.id is a string before using .has()
          col.enableColumnFilter !== false &&
          (!filteredColumnIds.has(col.id) || col.id === currentColumnId)
      ),
    [columns, filteredColumnIds, currentColumnId]
  );

  return (
    <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-11 w-[150px] justify-between font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Search columns..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup>
              {selectableColumns.map((col) => {
                const colLabel = col.meta?.label ?? col.id;
                return (
                  <CommandItem
                    key={col.id}
                    value={colLabel}
                    onSelect={() => {
                      if (col.id) onSelect(col.id); // FIX: Guard against undefined
                      setSelectorOpen(false);
                      setInputValue('');
                    }}
                  >
                    {colLabel}
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

// ───────────────── BLOCK 7: Exports ──────────────────────────
// DataTableFilterList is the only export.