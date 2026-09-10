"use client"

// ───────────────── BLOCK 1: Imports ──────────────────────────────────────────
import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DataTable,
  DataTableFacetedFilter,
  DataTableFilterList,
  DataTablePagination,
  DataTableToolbar,
  useDataTable,
} from "@/components/shared/data-table"
import type {
  DataTableRequest,
  DataTableResponseData,
} from "@/components/shared/data-table/types"
import { fetchBomsPage } from "../actions/bom-actions"
import type { BomListItem } from "../types/bom-schema"

// ───────────────── BLOCK 2: Helpers ──────────────────────────────────────────
const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function formatStatus(value: BomListItem["status"]) {
  return value.charAt(0) + value.slice(1).toLocaleLowerCase()
}

// ───────────────── BLOCK 3: Column Definitions ───────────────────────────────
const columns: ColumnDef<BomListItem>[] = [
  {
    accessorKey: "product_code",
    header: "Product",
    meta: { label: "Product Code", variant: "text" },
    cell: ({ row }) => (
      <span className="font-medium text-foreground">
        {row.original.product_code}
      </span>
    ),
  },
  {
    accessorKey: "product_description",
    header: "Description",
    meta: { label: "Description", variant: "text" },
    cell: ({ row }) => (
      <span className="block max-w-[300px] truncate" title={row.original.product_description ?? undefined}>
        {row.original.product_description ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "customer_name",
    header: "Customer",
    meta: { label: "Customer", variant: "text" },
    cell: ({ row }) => row.original.customer_name ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "revision",
    header: "Revision",
    meta: { label: "Revision", variant: "number" },
    cell: ({ row }) => <span className="tabular-nums">{row.original.revision}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: {
      label: "Status",
      variant: "multiSelect",
      options: [
        { label: "Draft", value: "DRAFT" },
        { label: "Active", value: "ACTIVE" },
        { label: "Archived", value: "ARCHIVED" },
      ],
    },
    cell: ({ row }) => (
      <Badge variant={row.original.status === "ACTIVE" ? "default" : "secondary"}>
        {formatStatus(row.original.status)}
      </Badge>
    ),
  },
  {
    accessorKey: "component_count",
    header: "Components",
    meta: { label: "Component Count", variant: "number" },
    cell: ({ row }) => <span className="tabular-nums">{row.original.component_count}</span>,
  },
  {
    accessorKey: "health",
    header: "Health",
    meta: {
      label: "Health",
      variant: "multiSelect",
      options: [
        { label: "Complete", value: "COMPLETE" },
        { label: "Attention", value: "ATTENTION" },
      ],
    },
    cell: ({ row }) => (
      <Badge variant={row.original.health === "ATTENTION" ? "destructive" : "secondary"}>
        {row.original.health === "ATTENTION" ? "Attention" : "Complete"}
      </Badge>
    ),
  },
  {
    accessorKey: "issue_count",
    header: "Issues",
    meta: { label: "Issue Count", variant: "number" },
    cell: ({ row }) => (
      <span className={row.original.issue_count > 0 ? "font-medium text-destructive tabular-nums" : "tabular-nums"}>
        {row.original.issue_count}
      </span>
    ),
  },
  {
    accessorKey: "updated_at",
    header: "Updated",
    meta: { label: "Updated", variant: "date" },
    cell: ({ row }) => dateFormatter.format(new Date(row.original.updated_at)),
  },
]

// ───────────────── BLOCK 4: Component ────────────────────────────────────────
export function BomsTable() {
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
  } = useDataTable<BomListItem>({
    columns,
    fetchPage: React.useCallback(
      (params: DataTableRequest): Promise<DataTableResponseData<BomListItem>> =>
        fetchBomsPage(params),
      []
    ),
  })

  const pagination = table.getState().pagination
  const getFacetedValue = (columnId: string): string[] => {
    const filter = filters.find((item) => item.id === columnId)
    return filter && Array.isArray(filter.value) ? filter.value.map(String) : []
  }
  const onFacetedChange = (columnId: string, values: string[]) => {
    if (values.length === 0) onFilterRemove(columnId)
    else onFilterChange({ id: columnId, operator: "contains", value: values })
  }

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar
        table={table}
        search={search ?? ""}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search products, customers, or BOM status..."
      >
        <DataTableFacetedFilter
          title="Status"
          options={[
            { label: "Draft", value: "DRAFT" },
            { label: "Active", value: "ACTIVE" },
            { label: "Archived", value: "ARCHIVED" },
          ]}
          selectedValues={getFacetedValue("status")}
          onValueChange={(values) => onFacetedChange("status", values)}
        />
        <DataTableFacetedFilter
          title="Health"
          options={[
            { label: "Complete", value: "COMPLETE" },
            { label: "Attention", value: "ATTENTION" },
          ]}
          selectedValues={getFacetedValue("health")}
          onValueChange={(values) => onFacetedChange("health", values)}
        />
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
        <div className="space-y-2" aria-busy="true" aria-label="Loading BOMs">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="h-10 w-full" key={index} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No BOMs found.
        </div>
      ) : (
        <DataTable
          table={table}
          getRowHref={(bom) => `/products/boms/${bom.id}`}
        />
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
