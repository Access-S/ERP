"use client"

import * as React from "react"
import Link from "next/link"
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
import { fetchProductsPage } from "../actions/product-actions"
import type { ProductListItem } from "../types/product-schema"

const productColumns: ColumnDef<ProductListItem>[] = [
  {
    accessorKey: "product_code",
    header: "Product",
    meta: { label: "Product Code", variant: "text" },
    cell: ({ row }) => (
      <Link
        className="font-medium text-foreground underline-offset-4 hover:underline"
        href={`/products/catalog/${row.original.id}`}
      >
        {row.original.product_code}
      </Link>
    ),
  },
  {
    accessorKey: "description",
    header: "Description",
    meta: { label: "Description", variant: "text" },
    cell: ({ row }) => (
      <span className="block max-w-[320px] truncate" title={row.original.description ?? undefined}>
        {row.original.description ?? <span className="text-muted-foreground">—</span>}
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
    accessorKey: "units_per_shipper",
    header: "Units/Shipper",
    meta: { label: "Units per Shipper", variant: "number" },
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.units_per_shipper ?? <span className="text-muted-foreground">—</span>}
      </span>
    ),
  },
  {
    accessorKey: "bom_state",
    header: "Active BOM",
    meta: {
      label: "Active BOM",
      variant: "multiSelect",
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Missing", value: "MISSING" },
      ],
    },
    cell: ({ row }) => row.original.active_bom_id ? (
      <Link href={`/products/boms/${row.original.active_bom_id}`}>
        <Badge variant="secondary">Rev {row.original.active_bom_revision}</Badge>
      </Link>
    ) : (
      <Badge variant="destructive">Missing</Badge>
    ),
  },
  {
    accessorKey: "component_count",
    header: "Components",
    meta: { label: "Component Count", variant: "number" },
    cell: ({ row }) => <span className="tabular-nums">{row.original.component_count}</span>,
  },
  {
    accessorKey: "is_active",
    header: "Status",
    meta: {
      label: "Product Status",
      variant: "multiSelect",
      options: [
        { label: "Active", value: "true" },
        { label: "Inactive", value: "false" },
      ],
    },
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? "default" : "outline"}>
        {row.original.is_active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
]

export function ProductsTable() {
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
  } = useDataTable<ProductListItem>({
    columns: productColumns,
    fetchPage: React.useCallback(
      (params: DataTableRequest): Promise<DataTableResponseData<ProductListItem>> =>
        fetchProductsPage(params),
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
        searchPlaceholder="Search products or customers..."
      >
        <DataTableFacetedFilter
          title="Product Status"
          options={[
            { label: "Active", value: "true" },
            { label: "Inactive", value: "false" },
          ]}
          selectedValues={getFacetedValue("is_active")}
          onValueChange={(values) => onFacetedChange("is_active", values)}
        />
        <DataTableFacetedFilter
          title="BOM"
          options={[
            { label: "Active", value: "ACTIVE" },
            { label: "Missing", value: "MISSING" },
          ]}
          selectedValues={getFacetedValue("bom_state")}
          onValueChange={(values) => onFacetedChange("bom_state", values)}
        />
        <DataTableFilterList
          columns={productColumns}
          filters={filters}
          joinOperator={joinOperator}
          onFilterChange={onFilterChange}
          onFilterRemove={onFilterRemove}
          onFiltersClear={onFiltersClear}
          onJoinOperatorChange={onJoinOperatorChange}
        />
      </DataTableToolbar>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading Products">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="h-10 w-full" key={index} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No Products found.
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
