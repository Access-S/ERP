"use client"

// ───────────────── BLOCK 1: Imports ────────────────────────────
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
import { cn } from "@/lib/utils"
import type {
  DataTableRequest,
  DataTableResponseData,
} from "@/components/shared/data-table/types"
import { fetchCustomersPage } from "../actions/customer-actions"
import type { Customer } from "../types/customer-schema"

// ───────────────── BLOCK 2: Helpers ────────────────────────────
// Module-level formatter is deterministic; it renders no rows during SSR
// (rows only appear after the client-side fetch resolves), so there is no
// hydration mismatch risk.
const numberFormatter = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// ───────────────── BLOCK 3: Column Definitions ─────────────────
// meta.variant drives which operators the FilterList offers per column.
// Wide text columns render inside a max-w + truncate wrapper so the
// finished table always fits the page width — no horizontal scrollbar.
// The full value is available on hover via the native title tooltip.

/** Caps a cell's width and ellipsizes overflow; hover shows the full value. */
function TruncatedText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("block truncate", className)} title={text}>
      {text}
    </span>
  )
}

export const customerColumns: ColumnDef<Customer>[] = [
  {
    accessorKey: "customer_code",
    header: "Code",
    meta: { label: "Customer Code", variant: "text" },
    cell: ({ row }) => (
      <span className="font-medium text-foreground">
        {row.original.customer_code}
      </span>
    ),
  },
  {
    accessorKey: "trading_name",
    header: "Trading Name",
    meta: { label: "Trading Name", variant: "text" },
    cell: ({ row }) =>
      row.original.trading_name ? (
        <TruncatedText className="max-w-[200px]" text={row.original.trading_name} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "legal_name",
    header: "Legal Name",
    meta: { label: "Legal Name", variant: "text" },
    cell: ({ row }) => (
      <TruncatedText className="max-w-[260px]" text={row.original.legal_name} />
    ),
  },
  {
    accessorKey: "customer_type",
    header: "Type",
    meta: { label: "Customer Type", variant: "text" },
    cell: ({ row }) => (
      <TruncatedText className="max-w-[120px]" text={row.original.customer_type} />
    ),
  },
  {
    accessorKey: "industry",
    header: "Industry",
    meta: { label: "Industry", variant: "text" },
    cell: ({ row }) =>
      row.original.industry ? (
        <TruncatedText className="max-w-[200px]" text={row.original.industry} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "payment_terms",
    header: "Payment Terms",
    meta: { label: "Payment Terms", variant: "text" },
    cell: ({ row }) =>
      row.original.payment_terms ? (
        <TruncatedText className="max-w-[120px]" text={row.original.payment_terms} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "credit_limit",
    header: "Credit Limit",
    meta: { label: "Credit Limit", variant: "number" },
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {row.original.default_currency} {numberFormatter.format(row.original.credit_limit)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { label: "Status", variant: "text" },
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? "default" : "secondary"}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Created",
    meta: { label: "Created At", variant: "date" },
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {formatDate(row.original.created_at)}
      </span>
    ),
  },
]

// ───────────────── BLOCK 4: Component ──────────────────────────
export function CustomersTable() {
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
  } = useDataTable<Customer>({
    columns: customerColumns,
    // Rule 9: stable fetchPage identity — a fresh inline arrow here would
    // retrigger the hook's fetch effect on every render.
    fetchPage: React.useCallback(
      (params: DataTableRequest): Promise<DataTableResponseData<Customer>> =>
        fetchCustomersPage(params),
      []
    ),
  })

  // Pagination state lives in the table instance (synced to the URL by the hook).
  const pagination = table.getState().pagination

  // ── Faceted filter helpers (is_active) ──
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
        searchPlaceholder="Search customers..."
      >
        <DataTableFacetedFilter
          title="Status"
          options={[
            { label: "Active", value: "true" },
            { label: "Inactive", value: "false" },
          ]}
          selectedValues={getFacetedValue("is_active")}
          onValueChange={(values) => onFacetedChange("is_active", values)}
        />
        <DataTableFilterList
          columns={customerColumns}
          filters={filters}
          joinOperator={joinOperator}
          onFilterChange={onFilterChange}
          onFilterRemove={onFilterRemove}
          onFiltersClear={onFiltersClear}
          onJoinOperatorChange={onJoinOperatorChange}
        />
      </DataTableToolbar>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading customers">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No customers found.
        </div>
      ) : (
        <DataTable
          table={table}
          getRowHref={(customer) => `/products/customers/${customer.id}`}
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
