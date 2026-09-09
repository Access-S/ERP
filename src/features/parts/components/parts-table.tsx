"use client"

// ───────────────── BLOCK 1: Imports ──────────────────────────────────────────
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
  Option,
} from "@/components/shared/data-table/types"
import { fetchPartsPage } from "../actions/part-actions"
import type { Part } from "../types/part-schema"

// ───────────────── BLOCK 2: Column Definitions ───────────────────────────────
function buildPartColumns(partTypeOptions: Option[]): ColumnDef<Part>[] {
  return [
    {
      accessorKey: "part_code",
      header: "Part",
      meta: { label: "Part Code", variant: "text" },
      cell: ({ row }) => (
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href={`/products/parts/${row.original.id}`}
        >
          {row.original.part_code}
        </Link>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      meta: { label: "Description", variant: "text" },
      cell: ({ row }) => (
        <span className="block max-w-[360px] truncate" title={row.original.description ?? undefined}>
          {row.original.description ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "part_type",
      header: "Type",
      meta: {
        label: "Part Type",
        variant: partTypeOptions.length > 0 ? "multiSelect" : "text",
        options: partTypeOptions,
      },
      cell: ({ row }) => row.original.part_type ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "default_uom",
      header: "Default UOM",
      meta: { label: "Default UOM", variant: "text" },
      cell: ({ row }) => row.original.default_uom ?? <span className="text-muted-foreground">Not set</span>,
    },
    {
      accessorKey: "bom_count",
      header: "BOMs",
      meta: { label: "BOM Count", variant: "number" },
      cell: ({ row }) => <span className="tabular-nums">{row.original.bom_count}</span>,
    },
    {
      accessorKey: "line_count",
      header: "Usage Lines",
      meta: { label: "Usage Line Count", variant: "number" },
      cell: ({ row }) => <span className="tabular-nums">{row.original.line_count}</span>,
    },
    {
      accessorKey: "is_active",
      header: "Status",
      meta: {
        label: "Status",
        variant: "multiSelect",
        options: [
          { label: "Active", value: "true" },
          { label: "Inactive", value: "false" },
        ],
      },
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "secondary" : "outline"}>
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ]
}

// ───────────────── BLOCK 3: Component ────────────────────────────────────────
interface PartsTableProps {
  partTypeOptions?: Option[]
}

export function PartsTable({ partTypeOptions = [] }: PartsTableProps) {
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
    fetchPage: React.useCallback(
      (params: DataTableRequest): Promise<DataTableResponseData<Part>> => fetchPartsPage(params),
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
        searchPlaceholder="Search Parts..."
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
        <div className="space-y-2" aria-busy="true" aria-label="Loading Parts">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="h-10 w-full" key={index} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No Parts found.
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
