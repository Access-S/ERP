//src/components/shared/data-table/types/index.ts

// ───────────────── BLOCK 1: Schema Re-exports ──────────────────
export {
  filterOperatorSchema,
  filterVariantSchema,
  joinOperatorSchema,
  sortItemSchema,
  filterItemSchema,
  optionSchema,
  dataTableRequestSchema,
  dataTableResponseSchema,
} from './schemas';

// ───────────────── BLOCK 2: Type Re-exports ────────────────────
export type {
  FilterOperator,
  FilterVariant,
  JoinOperator,
  SortItem,
  FilterItem,
  Option,
  DataTableRequest,
  DataTableResponse,
  DataTableResponseData,
} from './schemas';

// ───────────────── BLOCK 3: TanStack Integration ───────────────
import type { RowData } from '@tanstack/react-table';
import type { ComponentType, ComponentProps } from 'react';
import type { FilterVariant } from './schemas';

/** Convenience type — constrains generic TData to TanStack's RowData */
export type DataTableRowData = RowData;

// ───────────────── BLOCK 4: ColumnMeta Module Augmentation ─────
/**
 * Extends TanStack's ColumnMeta with data-table-specific fields.
 * Used in column definitions:
 *   { accessorKey: 'status', meta: { variant: 'select', label: 'Status', options: [...] } }
 *
 * NOT exported — this is a module augmentation, not a value.
 * It takes effect when any file imports from this module.
 */
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Human-readable column name — used in filter list display */
    label?: string;
    /** Which filter UI to render in the filter menu */
    variant?: FilterVariant;
    /** Placeholder text for filter inputs */
    placeholder?: string;
    /** Options for select/multiSelect filter variants */
    options?: {
      label: string;
      value: string;
      count?: number;
      icon?: ComponentType<ComponentProps<'svg'>>;
    }[];
    /** Min/max range for range filter variant */
    range?: [number, number];
    /** Unit label displayed next to filter value (e.g., "kg", "days") */
    unit?: string;
    /** Icon for option items */
    icon?: ComponentType<ComponentProps<'svg'>>;
  }
}