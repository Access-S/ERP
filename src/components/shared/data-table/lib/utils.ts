//src/components/shared/data-table/lib/utils.ts

// ───────────────── BLOCK 1: Imports ────────────────────────────
import type React from 'react';
import type { Column } from '@tanstack/react-table';
import { dataTableDefaults } from '../defaults';
import type { FilterItem, FilterOperator, FilterVariant } from '../types';

// ───────────────── BLOCK 2: Column Pinning ─────────────────────
export function getColumnPinningStyle<TData>({
  column,
  withBorder = false,
}: {
  column: Column<TData>;
  withBorder?: boolean;
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === 'left' && column.getIsLastColumn('left');
  const isFirstRightPinnedColumn =
    isPinned === 'right' && column.getIsFirstColumn('right');

  return {
    boxShadow: withBorder
      ? isLastLeftPinnedColumn
        ? '-4px 0 4px -4px var(--border) inset'
        : isFirstRightPinnedColumn
          ? '4px 0 4px -4px var(--border) inset'
          : undefined
      : undefined,
    left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
    right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
    opacity: isPinned ? 0.97 : 1,
    position: isPinned ? 'sticky' : 'relative',
    background: isPinned ? 'var(--background)' : 'var(--background)',
    width: column.getSize(),
    zIndex: isPinned ? 1 : undefined,
  };
}

// ───────────────── BLOCK 3: Filter Operators ───────────────────
export function getFilterOperators(
  filterVariant: FilterVariant
): { label: string; value: FilterOperator }[] {
  return dataTableDefaults.operatorsByVariant[filterVariant];
}

export function getDefaultFilterOperator(
  filterVariant: FilterVariant
): FilterOperator {
  const operators = getFilterOperators(filterVariant);
  // Fixed: was returning "eq" which doesn't exist in the operator list
  return operators[0]?.value ?? 'equals';
}

// ───────────────── BLOCK 4: Filter Validation ──────────────────
export function getValidFilters(filters: FilterItem[]): FilterItem[] {
  return filters.filter(
    (filter) =>
      filter.operator === 'isEmpty' ||
      filter.operator === 'isNotEmpty' ||
      (Array.isArray(filter.value)
        ? filter.value.length > 0
        : filter.value !== '' &&
          filter.value !== null &&
          filter.value !== undefined)
  );
}

// ───────────────── BLOCK 5: Exports ────────────────────────────
export { getColumnPinningStyle, getFilterOperators, getDefaultFilterOperator, getValidFilters };