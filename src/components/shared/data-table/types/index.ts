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

/** Convenience type — constrains generic TData to TanStack's RowData */
export type DataTableRowData = RowData;