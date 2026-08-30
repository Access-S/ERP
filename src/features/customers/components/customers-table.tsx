"use client"

// ───────────────── BLOCK 1: Imports ────────────────────────────
import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable, DataTablePagination, useDataTable } from "@/components/shared/data-table"
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
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
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
export const customerColumns: ColumnDef<Customer>[] = [
  {
    accessorKey: "customer_code",
    header: "Code",
    meta: { label: "Customer Code" },
    cell: ({ row }) => (
      <span className="font-medium">{row.original.customer_code}</span>
    ),
  },
  {
    accessorKey: "trading_name",
    header: "Trading Name",
    meta: { label: "Trading Name" },
    cell: ({ row }) =>
      row.original.trading_name ?? (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "legal_name",
    header: "Legal Name",
    meta: { label: "Legal Name" },
  },
  {
    accessorKey: "customer_type",
    header: "Type",
    meta: { label: "Customer Type" },
  },
  {
    accessorKey: "industry",
    header: "Industry",
    meta: { label: "Industry" },
    cell: ({ row }) =>
      row.original.industry ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "payment_terms",
    header: "Payment Terms",
    meta: { label: "Payment Terms" },
    cell: ({ row }) =>
      row.original.payment_terms ?? (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "credit_limit",
    header: "Credit Limit",
    meta: { label: "Credit Limit" },
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {currencyFormatter.format(row.original.credit_limit)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { label: "Status" },
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? "default" : "secondary"}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Created",
    meta: { label: "Created At" },
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {formatDate(row.original.created_at)}
      </span>
    ),
  },
]

// ───────────────── BLOCK 4: Component ──────────────────────────
export function CustomersTable() {
  const { table, data, isLoading, pageCount } = useDataTable<Customer>({
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

  return (
    <div className="flex flex-col gap-4">
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
