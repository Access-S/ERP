"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"

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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchCustomerOrdersPage } from "../actions/customer-order-actions"
import type { CustomerOrderListItem } from "../types/customer-order-schema"

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const orderTypeOptions = [
  { label: "Standard", value: "STANDARD" },
  { label: "Blanket", value: "BLANKET" },
]

const orderStatusOptions = [
  { label: "Draft", value: "DRAFT" },
  { label: "PO Check", value: "PO_CHECK" },
  { label: "Active", value: "ACTIVE" },
  { label: "Exhausted", value: "EXHAUSTED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Closed", value: "CLOSED" },
  { label: "Cancelled", value: "CANCELLED" },
]

function statusLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ")
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "PO_CHECK") return "destructive"
  if (status === "ACTIVE" || status === "READY_FOR_PLANNING") return "default"
  if (status === "CANCELLED" || status === "CLOSED") return "outline"
  return "secondary"
}

const columns: ColumnDef<CustomerOrderListItem>[] = [
  {
    accessorKey: "internalOrderNumber",
    header: "ERP Order",
    meta: { label: "ERP Order", variant: "text" },
    cell: ({ row }) => (
      <span className="font-medium text-foreground">
        {row.original.internalOrderNumber}
      </span>
    ),
  },
  {
    accessorKey: "customerPoNumber",
    header: "Customer PO",
    meta: { label: "Customer PO", variant: "text" },
  },
  {
    accessorKey: "customerName",
    header: "Customer",
    meta: { label: "Customer", variant: "text" },
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.customerName}</div>
        <div className="text-xs text-muted-foreground">{row.original.customerCode}</div>
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    meta: { label: "Order Type", variant: "multiSelect", options: orderTypeOptions },
    cell: ({ row }) => <Badge variant="outline">{statusLabel(row.original.type)}</Badge>,
  },
  {
    accessorKey: "receivedDate",
    header: "Received",
    meta: { label: "Received Date", variant: "date" },
    cell: ({ row }) => dateFormatter.format(new Date(row.original.receivedDate)),
  },
  {
    accessorKey: "latestReleaseNumber",
    header: "Latest Release",
    meta: { label: "Latest Release", variant: "text" },
    cell: ({ row }) => row.original.latestReleaseNumber ? (
      <div className="space-y-1.5">
        <div className="font-medium">{row.original.latestReleaseNumber}</div>
        {row.original.latestReleaseStatus && (
          <Badge variant={statusVariant(row.original.latestReleaseStatus)}>
            {statusLabel(row.original.latestReleaseStatus)}
          </Badge>
        )}
      </div>
    ) : (
      <span className="text-muted-foreground">
        {row.original.releaseCount === 0 ? "No releases" : `${row.original.releaseCount} releases`}
      </span>
    ),
  },
  {
    accessorKey: "expectedNetTotal",
    header: "Expected Value",
    meta: { label: "Expected Value", variant: "number" },
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.expectedNetTotal === null
          ? <span className="text-muted-foreground">—</span>
          : `${row.original.currency} ${row.original.expectedNetTotal.toFixed(2)}`}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: { label: "Order Status", variant: "multiSelect", options: orderStatusOptions },
    cell: ({ row }) => (
      <Badge variant={statusVariant(row.original.status)}>
        {statusLabel(row.original.status)}
      </Badge>
    ),
  },
]

export function CustomerOrdersTable() {
  const {
    table,
    data,
    isLoading,
    isError,
    pageCount,
    search,
    filters,
    joinOperator,
    onFilterChange,
    onFilterRemove,
    onFiltersClear,
    onSearchChange,
    onJoinOperatorChange,
  } = useDataTable<CustomerOrderListItem>({
    columns,
    fetchPage: React.useCallback(
      (params: DataTableRequest): Promise<DataTableResponseData<CustomerOrderListItem>> =>
        fetchCustomerOrdersPage(params),
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
        searchPlaceholder="Search Customer Orders..."
      >
        <DataTableFacetedFilter
          title="Type"
          options={orderTypeOptions}
          selectedValues={getFacetedValue("type")}
          onValueChange={(values) => onFacetedChange("type", values)}
        />
        <DataTableFacetedFilter
          title="Status"
          options={orderStatusOptions}
          selectedValues={getFacetedValue("status")}
          onValueChange={(values) => onFacetedChange("status", values)}
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
        <div className="space-y-2" aria-busy="true" aria-label="Loading Customer Orders">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="h-14 w-full" key={index} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex h-32 items-center justify-center text-sm text-destructive">
          Customer Orders could not be loaded. Please try again.
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No Customer Orders found.
        </div>
      ) : (
        <DataTable
          table={table}
          getRowHref={(order) => `/customer-orders/${order.id}`}
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
