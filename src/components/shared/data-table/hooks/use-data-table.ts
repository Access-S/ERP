//src/components/shared/data-table/use-data-table.ts

// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client';

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type TableOptions,
  type TableState,
  type Updater,
  type VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  useReactTable,
} from "@tanstack/react-table";
import {
  parseAsInteger,
  parseAsString,
  useQueryState,
} from "nuqs";

// ───────────────── BLOCK 2: Types & Zod Schemas ────────────────
interface UseDataTableProps<TData>
  extends Omit<
      TableOptions<TData>,
      | "state"
      | "pageCount"
      | "getCoreRowModel"
      | "manualFiltering"
      | "manualPagination"
      | "manualSorting"
    >,
    Required<Pick<TableOptions<TData>, "pageCount">> {
  initialState?: Omit<Partial<TableState>, "sorting"> & {
    sorting?: SortingState;
  };
  history?: "push" | "replace";
  debounceMs?: number;
  clearOnDefault?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  startTransition?: React.TransitionStartFunction;
}

// Custom parser to serialize SortingState to URL string (e.g., "supplier.desc")
const parseSorting = (value: string): SortingState => {
  if (!value) return [];
  const [id, dir] = value.split(".");
  return [{ id, desc: dir === "desc" }];
};

const serializeSorting = (value: SortingState): string => {
  if (!value.length) return "";
  const { id, desc } = value[0];
  return `${id}.${desc ? "desc" : "asc"}`;
};

// ───────────────── BLOCK 3: Component / Service ────────────────
export function useDataTable<TData>(props: UseDataTableProps<TData>) {
  const {
    columns,
    pageCount = -1,
    initialState,
    history = "replace",
    debounceMs = 300,
    clearOnDefault = true,
    scroll = false,
    shallow = true,
    startTransition,
    ...tableProps
  } = props;

  const queryStateOptions = React.useMemo(
    () => ({
      history,
      scroll,
      shallow,
      throttleMs: 50,
      debounceMs,
      clearOnDefault,
      startTransition,
    }),
    [history, scroll, shallow, debounceMs, clearOnDefault, startTransition]
  );

  // Local States
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    initialState?.rowSelection ?? {}
  );
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    initialState?.columnVisibility ?? {}
  );
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    initialState?.columnFilters ?? []
  );

  // URL States (nuqs)
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withOptions(queryStateOptions).withDefault(1)
  );
  const [perPage, setPerPage] = useQueryState(
    "perPage",
    parseAsInteger.withOptions(queryStateOptions).withDefault(10)
  );
  const [sorting, setSorting] = useQueryState(
    "sort",
    parseAsString.withOptions(queryStateOptions)
      .withDefault(initialState?.sorting ? serializeSorting(initialState.sorting) : "")
      .parseSearchAs(parseSorting)
      .serializeSearch(serializeSorting) as unknown as SortingState // Type cast for nuqs custom parser
  );

  const pagination: PaginationState = React.useMemo(() => {
    return {
      pageIndex: page - 1, // zero-based index for TanStack
      pageSize: perPage,
    };
  }, [page, perPage]);

  const onPaginationChange = React.useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      if (typeof updaterOrValue === "function") {
        const newPagination = updaterOrValue(pagination);
        void setPage(newPagination.pageIndex + 1);
        void setPerPage(newPagination.pageSize);
      } else {
        void setPage(updaterOrValue.pageIndex + 1);
        void setPerPage(updaterOrValue.pageSize);
      }
    },
    [pagination, setPage, setPerPage]
  );

  const onSortingChange = React.useCallback(
    (updaterOrValue: Updater<SortingState>) => {
      if (typeof updaterOrValue === "function") {
        const newSorting = updaterOrValue(sorting);
        void setSorting(serializeSorting(newSorting));
      } else {
        void setSorting(serializeSorting(updaterOrValue));
      }
    },
    [sorting, setSorting]
  );

  const table = useReactTable({
    ...tableProps,
    columns,
    initialState,
    pageCount,
    state: {
      pagination,
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    defaultColumn: {
      ...tableProps.defaultColumn,
      enableColumnFilter: false, // Disabling default column filter for Phase 1
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: false, // Setting to false for local search filter in Phase 1
  });

  return React.useMemo(() => ({ table }), [table]);
}

// ───────────────── BLOCK 4: Exports ────────────────────────────
export { useDataTable };
export type { UseDataTableProps };