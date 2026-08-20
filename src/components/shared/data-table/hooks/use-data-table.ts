// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client';

import * as React from 'react';
import {
  type ColumnDef,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type TableState,
  type Updater,
  type VisibilityState,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { createParser, parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import { dataTableDefaults } from '../defaults';
import { upsertFilter, removeFilter } from '../lib/filters';
import type {
  DataTableRequest,
  DataTableResponseData,
  DataTableRowData,
  FilterItem,
  JoinOperator,
} from '../types';

// ───────────────── BLOCK 2: Custom Nuqs Parsers ───────────────
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

const filterParser = createParser({
  parse(value: string): FilterItem[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  },
  serialize(value: FilterItem[]): string {
    if (!value.length) return '';
    return JSON.stringify(value);
  },
}).withDefault([]);

const joinOperatorParser = createParser({
  parse(value: string): JoinOperator {
    if (value === 'or') return 'or';
    return 'and';
  },
  serialize(value: JoinOperator): string {
    return value;
  },
}).withDefault('and');

// ───────────────── BLOCK 3: Props ────────────────────────────
interface UseDataTableProps<TData extends DataTableRowData> {
  columns: ColumnDef<TData>[];
  fetchPage: (params: DataTableRequest) => Promise<DataTableResponseData<TData>>;
  initialState?: Partial<Pick<TableState, 'rowSelection' | 'columnVisibility'>> & {
    columnFilters?: FilterItem[];
  };
}

// ───────────────── BLOCK 4: Ref Helper ────────────────────────
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

  // ── URL state ──
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

  const [filters, setFilters] = useQueryState(
    dataTableDefaults.urlKeys.filters,
    filterParser.withOptions(nuqsOpts)
  );

  const [joinOperator, setJoinOperator] = useQueryState(
    dataTableDefaults.urlKeys.joinOperator,
    joinOperatorParser.withOptions(nuqsOpts)
  );

  const [search, setSearch] = useQueryState(
    dataTableDefaults.urlKeys.search,
    parseAsString.withOptions(nuqsOpts).withDefault('')
  );

  // ── Local state (not URL-synced) ──
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    initialState?.rowSelection ?? {}
  );

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(
      initialState?.columnVisibility ?? {}
    );

  // ── Refs for stable callbacks (Rule 9) ──
  const pageRef = useStateRef(page);
  const perPageRef = useStateRef(perPage);
  const sortingRef = useStateRef(sorting);
  const filtersRef = useStateRef(filters);
  const searchRef = useStateRef(search);
  const joinOperatorRef = useStateRef(joinOperator);
  const fetchPageRef = useStateRef(fetchPage);

  // ── Data fetching state ──
  const [data, setData] = React.useState<TData[]>([]);
  const [pageCount, setPageCount] = React.useState(0);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isError, setIsError] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  // ── Fetch effect ──
  // Reads current values from refs to avoid stale closures.
  // Depends on URL-synced values — nuqs ensures these are
  // referentially stable when unchanged, preventing extra fetches.
  React.useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setIsError(false);
    setError(null);

    const params: DataTableRequest = {
      page: pageRef.current,
      pageSize: perPageRef.current,
      sorts: sortingRef.current,
      filters: filtersRef.current,
      joinOperator: joinOperatorRef.current,
      search: searchRef.current || undefined,
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
  }, [page, perPage, sorting, filters, joinOperator, search]);

  // ── Derived pagination state for TanStack (0-based) ──
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
      void setPage(1);
    },
    [setSorting, setPage]
  );

  const onFilterChange = React.useCallback(
    (filter: FilterItem) => {
      void setFilters((prev) => upsertFilter(prev, filter));
      void setPage(1);
    },
    [setFilters, setPage]
  );

  const onFilterRemove = React.useCallback(
    (columnId: string) => {
      void setFilters((prev) => removeFilter(prev, columnId));
    },
    [setFilters]
  );

  const onFiltersClear = React.useCallback(() => {
    void setFilters([]);
  }, [setFilters]);

  const onSearchChange = React.useCallback(
    (value: string) => {
      void setSearch(value || null);
      void setPage(1);
    },
    [setSearch, setPage]
  );

  const onJoinOperatorChange = React.useCallback(
    (value: JoinOperator) => {
      void setJoinOperator(value);
    },
    [setJoinOperator]
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
      filters,
      search,
      joinOperator,
      onFilterChange,
      onFilterRemove,
      onFiltersClear,
      onSearchChange,
      onJoinOperatorChange,
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
      filters,
      search,
      joinOperator,
      onFilterChange,
      onFilterRemove,
      onFiltersClear,
      onSearchChange,
      onJoinOperatorChange,
    ]
  );
}

// ───────────────── BLOCK 6: Type Exports ────────────────────
export type { UseDataTableProps };