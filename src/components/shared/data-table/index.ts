//src/components/shared/data-table/index.ts

// ───────────────── BLOCK 1: Component Exports ──────────────────
export { DataTable } from './components/data-table';
export { DataTableColumnHeader } from './components/data-table-column-header';
export { DataTableToolbar } from './components/data-table-toolbar';
export { DataTablePagination } from './components/data-table-pagination';
export { DataTableFacetedFilter } from './components/data-table-faceted-filter';
export { DataTableViewOptions } from './components/data-table-view-options';

// ───────────────── BLOCK 2: Hook Exports ───────────────────────
export { useDataTable } from './hooks/use-data-table';

// ───────────────── BLOCK 3: Type Exports ───────────────────────
export type {
  DataTableRowData,
  FilterOperator,
  FilterVariant,
  JoinOperator,
  SortItem,
  FilterItem,
  Option,
  DataTableRequest,
  DataTableResponse,
  DataTableResponseData,
} from './types';

// ───────────────── BLOCK 4: Schema Exports ─────────────────────
export {
  filterOperatorSchema,
  filterVariantSchema,
  joinOperatorSchema,
  sortItemSchema,
  filterItemSchema,
  optionSchema,
  dataTableRequestSchema,
  dataTableResponseSchema,
} from './types';

// ───────────────── BLOCK 5: Default Exports ────────────────────
export { dataTableDefaults } from './defaults';

// ───────────────── BLOCK 6: Utility Exports ────────────────────
export {
  getColumnPinningStyle,
  getFilterOperators,
  getDefaultFilterOperator,
  getValidFilters,
} from './lib/utils';