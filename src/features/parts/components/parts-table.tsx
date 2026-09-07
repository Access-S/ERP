"use client"

// ───────────────── BLOCK 1: Imports ────────────────────────────
import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DataTable,
  DataTableFacetedFilter,
  DataTableFilterList,
  DataTablePagination,
  DataTableToolbar,
  useDataTable,
} from "@/components/shared/data-table"
import { cn } from "@/lib/utils"
import type {
  DataTableRequest,
  DataTableResponseData,
  Option,
} from "@/components/shared/data-table/types"
import { fetchPartsPage } from "../actions/part-actions"
import type { Part } from "../types/part-schema"

// ───────────────── BLOCK 2: Helpers ────────────────────────────
const perShipperFormatter = new Intl.NumberFormat("en-US")

/** Caps a cell's width and ellipsizes overflow; hover shows the full value. */
function TruncatedText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("block truncate", className)} title={text}>
      {text}
    </span>
  )
}

// ───────────────── BLOCK 3: Column Definitions ─────────────────
// meta.variant drives which operators the FilterList offers per column.
// Wide text columns are width-capped so the table fits the page width.
// part_type becomes a searchable multi-select when the server supplies
// its distinct values; without them it falls back to free text.

interface PartsTableProps {
  /** Server-fetched distinct part_type values (with row counts). */
  partTypeOptions?: Option[]
}

function buildPartColumns(partTypeOptions: Option[]): ColumnDef<Part>[] {
  const hasTypes = partTypeOptions.length > 0
  return [
  {
    accessorKey: "part_code",
    header: "Code",
    meta: { label: "Part Code", variant: "text" },
    cell: ({ row }) => (
      <TruncatedText className="max-w-[140px]" text={row.original.part_code} />
    ),
  },
  {
    accessorKey: "part_description",
    header: "Description",
    meta: { label: "Description", variant: "text" },
    cell: ({ row }) =>
      row.original.part_description ? (
        <TruncatedText className="max-w-[260px]" text={row.original.part_description} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "part_type",
    header: "Type",
    meta: {
      label: "Part Type",
      variant: hasTypes ? "multiSelect" : "text",
      ...(hasTypes ? { options: partTypeOptions } : {}),
    },
    cell: ({ row }) =>
      row.original.part_type ? (
        <TruncatedText className="max-w-[120px]" text={row.original.part_type} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "product_code",
    header: "Product",
    meta: { label: "Product", variant: "text" },
    cell: ({ row }) =>
      row.original.product_code ? (
        <TruncatedText className="max-w-[140px]" text={row.original.product_code} />
      ) : (
        <span className="text-muted-foreground">Unlinked</span>
      ),
  },
  {
    accessorKey: "per_shipper",
    header: "Per Shipper",
    meta: { label: "Per Shipper", variant: "number" },
    cell: ({ row }) =>
      row.original.per_shipper == null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="font-medium tabular-nums">
          {perShipperFormatter.format(row.original.per_shipper)}
        </span>
      ),
  },
  ]
}

// ───────────────── BLOCK 4: Component ──────────────────────────
export function PartsTable({ partTypeOptions = [] }: PartsTableProps) {
  // Columns are rebuilt only when the server options change (stable identity).
  const columns = React.useMemo(() => buildPartColumns(partTypeOptions), [partTypeOptions])
  const {
    table,
    data,
    isLoading,
    pageCount,
    search,
    filters,
    joinOperator,
    onFilterChange,
    onFilterRemove,
    onFiltersClear,
    onSearchChange,
    onJoinOperatorChange,
  } = useDataTable<Part>({
    columns,
    // Rule 9: stable fetchPage identity — a fresh inline arrow here would
    // retrigger the hook's fetch effect on every render.
    fetchPage: React.useCallback(
      (params: DataTableRequest): Promise<DataTableResponseData<Part>> =>
        fetchPartsPage(params),
      []
    ),
  })

  // Pagination state lives in the table instance (synced to the URL by the hook).
  const pagination = table.getState().pagination

  // ── Faceted filter helpers (is_linked) ──
  const getFacetedValue = (columnId: string): string[] => {
    const filter = filters.find((f) => f.id === columnId)
    if (filter && Array.isArray(filter.value)) return filter.value as string[]
    return []
  }

  const onFacetedChange = (columnId: string, values: string[]) => {
    if (values.length === 0) {
      onFilterRemove(columnId)
    } else {
      onFilterChange({ id: columnId, operator: "contains", value: values })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar
        table={table}
        search={search ?? ""}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search parts..."
      >
        <DataTableFacetedFilter
          title="Linked"
          options={[
            { label: "Linked", value: "true" },
            { label: "Unlinked", value: "false" },
          ]}
          selectedValues={getFacetedValue("is_linked")}
          onValueChange={(values) => onFacetedChange("is_linked", values)}
        />
        {partTypeOptions.length > 0 && (
          <DataTableFacetedFilter
            title="Part Type"
            options={partTypeOptions}
            selectedValues={getFacetedValue("part_type")}
            onValueChange={(values) => onFacetedChange("part_type", values)}
          />
        )}
        <DataTableFilterList
          columns={columns}
          filters={filters}
          joinOperator={joinOperator}
          onFilterChange={onFilterChange}
          onFilterRemove={onFilterRemove}
          onFiltersClear={onFiltersClear}
          onJoinOperatorChange={onJoinOperatorChange}
        />
      </DataTableToolbar>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading parts">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No parts found.
        </div>
      ) : (
        <DataTable table={table} />
      )}

      <DataTablePagination
        page={pagination.pageIndex + 1}
        perPage={pagination.pageSize}
        pageCount={pageCount}
        onPageChange={(newPage) => table.setPageIndex(newPage - 1)}
        onPerPageChange={(newPerPage) => table.setPageSize(newPerPage)}
      />
    </div>
  )
}