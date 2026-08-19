// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client';

import * as React from 'react';
import {
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Table,
  type TableState,
  type Updater,
  type VisibilityState,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { createParser, parseAsInteger, useQueryState } from 'nuqs';
import { dataTableDefaults } from '../defaults';
import type {
  DataTableRequest,
  DataTableResponseData,
  DataTableRowData,
  FilterItem,
} from '../types';

// ───────────────── BLOCK 2: Custom Nuqs Parser (Multi-Sort) ───
const sortParser = createParser({
  parse(value: string): SortingState {
    if (!value) return [];
    return value.split(',').map((part) => {
      const [id, dir] = part.split('.');
      return { id, desc: dir === 'desc' };
    });
  },
  serialize(value: SortingState): string {
    if (!value.length) return '';
    return value
      .map(({ id, desc }) => `${id}.${desc ? 'desc' : 'asc'}`)
      .join(',');
  },
}).withDefault([]);

// ───────────────── BLOCK 3: Zod Schema for Props ───────────────
// Rule 5: Zod First for all data shapes.
// Note: ColumnDef and fetchPage can't be Zod-validated at runtime,
// but we define the structural shape here for documentation and
// to keep the pattern consistent.
interface UseDataTableProps<TData extends DataTableRowData> {
  columns: ColumnDef<TData>[];
  fetchPage: (params: DataTableRequest) => Promise<DataTableResponseData<TData>>;
  initialState?: Partial<
    Pick<TableState, 'rowSelection' | 'columnVisibility'>
  > & {
    columnFilters?: FilterItem[];
  };
}

// ───────────────── BLOCK 4: Refs for Stable Callbacks ──────────
// Rule 9: Callbacks that read changing state MUST use refs.
// We define the ref hook here to keep the main hook clean.
function useStateRef<T>(value: T): React.MutableRefObject<T> {
  const ref = React.useRef(value);
  ref.current = value;
  return ref;
}

// ───────────────── BLOCK 5: Hook Implementation ────────────────
export function useDataTable<TData extends DataTableRowData>({
  columns,
  fetchPage,
  initialState,
}: UseDataTableProps<TData>) {
  // ── Nuqs options (stable, never changes) ──
  const nuqsOpts = React.useMemo(
    () => ({
      history: dataTableDefaults.nuqsOptions.history,
      scroll: dataTableDefaults.nuqsOptions.scroll,
      shallow: dataTableDefaults.nuqsOptions.shallow,
      throttleMs: 50,
      debounceMs: dataTableDefaults.nuqsOptions.debounceMs,
      clearOnDefault: dataTableDefaults.nuqsOptions.clearOnDefault,
    }),
    []
  );

  // ── URL state (page, perPage, sort) ──
  const [page, setPage] = useQueryState(
    dataTableDefaults.urlKeys.page,
    parseAsInteger.withOptions(nuqsOpts).withDefault(1)
  );

  const [perPage, setPerPage] = useQueryState(
    dataTableDefaults.urlKeys.perPage,
    parseAsInteger.withOptions(nuqsOpts).withDefault(dataTableDefaults.pageSize)
  );

  const [sorting, setSorting] = useQueryState(
    dataTableDefaults.urlKeys.sort,
    sortParser.withOptions(nuqsOpts)
  );

  // ── Local state (not URL-synced) ──
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    initialState?.rowSelection ?? {}
  );

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(
      initialState?.columnVisibility ?? {}
    );

  const [columnFilters, setColumnFilters] = React.useState<FilterItem[]>(
    initialState?.columnFilters ?? []
  );

  // ── Refs for stable callbacks (Rule 9) ──
  const pageRef = useStateRef(page);
  const perPageRef = useStateRef(perPage);
  const sortingRef = useStateRef(sorting);
  const columnFiltersRef = useStateRef(columnFilters);
  const fetchPageRef = useStateRef(fetchPage);

  // ── Data fetching state ──
  const [data, setData] = React.useState<TData[]>([]);
  const [pageCount, setPageCount] = React.useState(0);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isError, setIsError] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  // ── Fetch effect ──
  // Reads current values from refs to avoid stale closures,
  // depends only on the URL-synced values that trigger re-fetches.
  React.useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setIsError(false);
    setError(null);

    const params: DataTableRequest = {
      page: pageRef.current,
      pageSize: perPageRef.current,
      sorts: sortingRef.current,
      filters: columnFiltersRef.current,
      joinOperator: 'and',
      search: undefined,
    };

    fetchPageRef
      .current(params)
      .then((response) => {
        if (!cancelled) {
          setData(response.data);
          setPageCount(response.pageCount);
          setTotalCount(response.totalCount);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setIsError(true);
          setError(err);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, perPage, sorting, columnFilters]);

  // ── Derived pagination state for TanStack ──
  const pagination: PaginationState = React.useMemo(
    () => ({
      pageIndex: page - 1,
      pageSize: perPage,
    }),
    [page, perPage]
  );

  // ── Stable callbacks (Rule 9: no changing state in deps) ──
  const onPaginationChange = React.useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      const current: PaginationState = {
        pageIndex: pageRef.current - 1,
        pageSize: perPageRef.current,
      };
      const newPagination =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(current)
          : updaterOrValue;
      void setPage(newPagination.pageIndex + 1);
      void setPerPage(newPagination.pageSize);
    },
    [setPage, setPerPage]
  );

  const onSortingChange = React.useCallback(
    (updaterOrValue: Updater<SortingState>) => {
      const current = sortingRef.current;
      const newSorting =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(current)
          : updaterOrValue;
      void setSorting(newSorting);
      void setPage(1); // Reset to page 1 on sort change
    },
    [setSorting, setPage]
  );

  // ── TanStack table instance ──
  // Only getCoreRowModel — all filtering, sorting, pagination
  // is handled server-side (Rule 2: Data Flow).
  const table = useReactTable({
    columns,
    data,
    pageCount,
    state: {
      pagination,
      sorting,
      columnVisibility,
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    onPaginationChange,
    onSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: true,
  });

  // ── Memoized return (Rule 9: Context Memoization) ──
  return React.useMemo(
    () => ({
      table,
      data,
      isLoading,
      isError,
      error,
      pageCount,
      totalCount,
      rowSelection,
      setRowSelection,
    }),
    [
      table,
      data,
      isLoading,
      isError,
      error,
      pageCount,
      totalCount,
      rowSelection,
      setRowSelection,
    ]
  );
}

// ───────────────── BLOCK 6: Type Exports ───────────────────────
export type { UseDataTableProps };