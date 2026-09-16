"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  LoaderCircle,
  Rows3,
  Search,
} from "lucide-react"
import {
  type Column,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table"

import {
  DataTableFacetedFilter,
  DataTableFilterList,
  DataTableViewOptions,
  useDataTable,
} from "@/components/shared/data-table"
import type {
  DataTableRequest,
  DataTableResponseData,
} from "@/components/shared/data-table/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { fetchCustomerOrdersPage } from "../actions/customer-order-actions"
import type { CustomerOrderListItem } from "../types/customer-order-schema"

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const orderStatusOptions = [
  { label: "Draft", value: "DRAFT" },
  { label: "PO Check", value: "PO_CHECK" },
  { label: "Active", value: "ACTIVE" },
  { label: "Exhausted", value: "EXHAUSTED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Closed", value: "CLOSED" },
  { label: "Cancelled", value: "CANCELLED" },
]

type TableDensity = "compact" | "comfortable"

const densityStorageKey = "customer-orders-table-density"
const densityChangeEvent = "customer-orders-density-change"

function getDensitySnapshot(): TableDensity {
  const stored = window.localStorage.getItem(densityStorageKey)
  return stored === "comfortable" ? "comfortable" : "compact"
}

function subscribeToDensity(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(densityChangeEvent, onStoreChange)
  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(densityChangeEvent, onStoreChange)
  }
}

function getServerDensitySnapshot(): TableDensity {
  return "compact"
}

function statusLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ")
}

function statusStyles(status: string): string {
  if (status === "PO_CHECK") {
    return "border-red-500/30 bg-red-500/10 text-red-400"
  }
  if (status === "ACTIVE") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
  }
  if (status === "CANCELLED") {
    return "border-border bg-muted/40 text-muted-foreground line-through"
  }
  return "border-border bg-muted/40 text-foreground"
}

function rowAccent(status: string): string {
  if (status === "PO_CHECK") return "border-l-red-500"
  if (status === "ACTIVE") return "border-l-emerald-500"
  if (status === "CANCELLED") return "border-l-muted-foreground/40"
  return "border-l-transparent"
}

function ErpColumnHeader<TData>({
  column,
  label,
  align = "left",
}: {
  column: Column<TData, unknown>
  label: string
  align?: "left" | "right"
}) {
  const sorted = column.getIsSorted()

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "flex h-11 w-full items-center justify-start gap-1.5 rounded-none px-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:bg-transparent hover:text-foreground",
        align === "right" && "justify-end"
      )}
      onClick={() => column.toggleSorting(sorted === "asc")}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      {sorted === "asc" ? (
        <ArrowUp className="size-3.5" aria-hidden="true" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5" aria-hidden="true" />
      ) : (
        <ChevronsUpDown className="size-3.5 opacity-45" aria-hidden="true" />
      )}
    </Button>
  )
}

const columns: ColumnDef<CustomerOrderListItem>[] = [
  {
    accessorKey: "internalOrderNumber",
    header: ({ column }) => <ErpColumnHeader column={column} label="Order" />,
    meta: { label: "Order Number", variant: "text" },
    cell: ({ row }) => (
      <span className="font-mono text-[13px] font-semibold tracking-wide text-foreground">
        {row.original.internalOrderNumber}
      </span>
    ),
  },
  {
    accessorKey: "customerPoNumber",
    header: ({ column }) => <ErpColumnHeader column={column} label="Customer PO" />,
    meta: { label: "Customer PO", variant: "text" },
    cell: ({ row }) => (
      <span className="font-medium text-foreground">{row.original.customerPoNumber}</span>
    ),
  },
  {
    accessorKey: "customerName",
    header: ({ column }) => <ErpColumnHeader column={column} label="Customer" />,
    meta: { label: "Customer", variant: "text" },
    cell: ({ row }) => (
      <div className="min-w-0 leading-tight">
        <div className="truncate font-medium text-foreground">{row.original.customerName}</div>
        <div className="mt-1 font-mono text-[11px] text-muted-foreground">
          {row.original.customerCode}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "receivedDate",
    header: ({ column }) => <ErpColumnHeader column={column} label="Received" />,
    meta: { label: "Received Date", variant: "date" },
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-foreground/85">
        {dateFormatter.format(new Date(row.original.receivedDate))}
      </span>
    ),
  },
  {
    accessorKey: "primarySkuCode",
    header: ({ column }) => <ErpColumnHeader column={column} label="SKU" />,
    meta: { label: "SKU Code", variant: "text" },
    cell: ({ row }) => row.original.primarySkuCode ? (
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="font-mono text-[13px] font-medium text-foreground">
          {row.original.primarySkuCode}
        </span>
        {row.original.additionalSkuCount > 0 && (
          <span className="rounded-sm border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            +{row.original.additionalSkuCount}
          </span>
        )}
      </div>
    ) : <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "primarySkuDescription",
    header: ({ column }) => <ErpColumnHeader column={column} label="Description" />,
    meta: { label: "SKU Description", variant: "text" },
    cell: ({ row }) => row.original.primarySkuDescription ? (
      <span
        className="block max-w-[20rem] truncate text-foreground/75"
        title={row.original.primarySkuDescription}
      >
        {row.original.primarySkuDescription}
      </span>
    ) : <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: "poAmount",
    header: ({ column }) => <ErpColumnHeader column={column} label="PO Amount" align="right" />,
    meta: { label: "PO Amount", variant: "number" },
    cell: ({ row }) => (
      <span className="block whitespace-nowrap text-right font-mono text-[13px] font-medium tabular-nums text-foreground">
        {row.original.poAmount === null
          ? "—"
          : `${row.original.currency} ${row.original.poAmount.toFixed(2)}`}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => <ErpColumnHeader column={column} label="Status" />,
    meta: { label: "Order Status", variant: "multiSelect", options: orderStatusOptions },
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={cn("whitespace-nowrap text-[11px] font-medium", statusStyles(row.original.status))}
      >
        {statusLabel(row.original.status)}
      </Badge>
    ),
  },
]

const columnWidths: Record<string, string> = {
  internalOrderNumber: "w-[92px]",
  customerPoNumber: "w-[132px]",
  customerName: "w-[170px]",
  receivedDate: "w-[120px]",
  primarySkuCode: "w-[130px]",
  primarySkuDescription: "min-w-[240px]",
  poAmount: "w-[145px]",
  status: "w-[118px]",
}

function skeletonWidth(columnId: string): string {
  switch (columnId) {
    case "internalOrderNumber": return "w-12"
    case "customerPoNumber": return "w-20"
    case "customerName": return "w-28"
    case "receivedDate": return "w-20"
    case "primarySkuCode": return "w-20"
    case "primarySkuDescription": return "w-44"
    case "poAmount": return "ml-auto w-24"
    case "status": return "w-16 rounded-full"
    default: return "w-4"
  }
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("a,button,input,select,[role='button'],[data-row-navigation-ignore]"))
}

interface CustomerOrdersTableProps {
  stats: {
    total: number
    poCheck: number
    readyForPlanning: number
  }
}

export function CustomerOrdersTable({
  stats,
}: CustomerOrdersTableProps) {
  const router = useRouter()
  const density = React.useSyncExternalStore(
    subscribeToDensity,
    getDensitySnapshot,
    getServerDensitySnapshot
  )
  const {
    table,
    data,
    isLoading,
    isError,
    pageCount,
    totalCount,
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
  const visibleColumns = table.getVisibleLeafColumns()
  const statusFilter = filters.find((filter) => filter.id === "status")
  const selectedStatuses = statusFilter && Array.isArray(statusFilter.value)
    ? statusFilter.value.map(String)
    : []
  const hasCriteria = Boolean(search) || filters.length > 0
  const firstResult = totalCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const lastResult = Math.min(totalCount, (pagination.pageIndex + 1) * pagination.pageSize)
  const rowHeight = density === "compact" ? "h-[52px]" : "h-[64px]"

  function changeDensity(value: string) {
    if (value !== "compact" && value !== "comfortable") return
    window.localStorage.setItem(densityStorageKey, value)
    window.dispatchEvent(new Event(densityChangeEvent))
  }

  function setStatusFilter(values: string[]) {
    if (values.length === 0) onFilterRemove("status")
    else onFilterChange({ id: "status", operator: "contains", value: values })
  }

  function navigateToOrder(
    event: React.MouseEvent<HTMLTableRowElement> | React.KeyboardEvent<HTMLTableRowElement>,
    orderId: string
  ) {
    if (isInteractiveTarget(event.target)) return
    if ("key" in event && event.key !== "Enter") return
    if ("button" in event && event.button !== 0) return

    const href = `/customer-orders/${orderId}`
    if ("metaKey" in event && (event.metaKey || event.ctrlKey)) {
      window.open(href, "_blank", "noopener,noreferrer")
      return
    }
    router.push(href)
  }

  return (
    <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border bg-muted/[0.16] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">Customer order register</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {totalCount || stats.total} orders · {stats.poCheck} require attention · {stats.readyForPlanning} releases ready
              </p>
            </div>
            {isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                Refreshing
              </div>
            )}
          </div>
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-background/60 p-1">
            <Button
              type="button"
              size="sm"
              variant={selectedStatuses.length === 0 ? "secondary" : "ghost"}
              className="h-9 px-3 text-xs"
              onClick={() => setStatusFilter([])}
            >
              All <span className="ml-1 text-muted-foreground">{stats.total}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={selectedStatuses.length === 1 && selectedStatuses[0] === "PO_CHECK" ? "secondary" : "ghost"}
              className="h-9 px-3 text-xs"
              onClick={() => setStatusFilter(["PO_CHECK"])}
            >
              PO Check <span className="ml-1 text-red-400">{stats.poCheck}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={selectedStatuses.length === 1 && selectedStatuses[0] === "CLOSED" ? "secondary" : "ghost"}
              className="h-9 px-3 text-xs"
              onClick={() => setStatusFilter(["CLOSED"])}
            >
              Closed
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search ?? ""}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search order, PO, customer or SKU"
              className="h-11 bg-background pl-9 pr-9"
              aria-label="Search Customer Orders"
            />
            {isLoading && (
              <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <DataTableFacetedFilter
            title="Status"
            options={orderStatusOptions}
            selectedValues={selectedStatuses}
            onValueChange={setStatusFilter}
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
          {hasCriteria && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 text-xs text-muted-foreground"
              onClick={() => {
                onSearchChange("")
                onFiltersClear()
              }}
            >
              Clear all
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto hidden h-10 lg:flex">
                <Rows3 className="mr-2 size-4" aria-hidden="true" />
                Density
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Row density</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={density} onValueChange={changeDensity}>
                <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DataTableViewOptions table={table} />
        </div>
      </div>

      <div className="relative w-full min-w-0 max-w-full overflow-hidden">
        <div
          className={cn(
            "absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden bg-transparent",
            isLoading && "bg-primary/10"
          )}
          aria-hidden="true"
        >
          {isLoading && <div className="h-full w-1/3 animate-pulse bg-primary" />}
        </div>
        <Table role="grid" className="min-w-[1080px] border-separate border-spacing-0 text-sm">
          <TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_var(--border)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} role="row" className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    role="columnheader"
                    className={cn(
                      "h-11 border-b border-border px-3 text-left align-middle",
                      columnWidths[header.column.id],
                      header.column.id === "poAmount" && "text-right",
                      header.column.id === "internalOrderNumber" && "sticky left-0 z-30 border-r border-border bg-card"
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody aria-busy={isLoading}>
            {isLoading ? (
              Array.from({ length: pagination.pageSize }, (_, rowIndex) => (
                <TableRow key={rowIndex} className={cn(rowHeight, "hover:bg-transparent")} aria-hidden="true">
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        "border-b border-border/65 px-3 align-middle",
                        columnWidths[column.id],
                        column.id === "internalOrderNumber" && "sticky left-0 z-10 border-r border-border/70 bg-card"
                      )}
                    >
                      <Skeleton className={cn("h-3.5", skeletonWidth(column.id))} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumns.length} className="h-40 px-4 text-center">
                  <p className="font-medium text-destructive">Customer Orders could not be loaded.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Check the connection and try again.</p>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumns.length} className="h-40 px-4 text-center">
                  <p className="font-medium text-foreground">No matching Customer Orders</p>
                  <p className="mt-1 text-xs text-muted-foreground">Change or clear the current search and filters.</p>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  role="row"
                  tabIndex={0}
                  className={cn(
                    "group cursor-pointer bg-card outline-none transition-colors hover:bg-primary/[0.035] focus-visible:bg-primary/[0.05] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    rowHeight
                  )}
                  onClick={(event) => navigateToOrder(event, row.original.id)}
                  onKeyDown={(event) => navigateToOrder(event, row.original.id)}
                  onMouseEnter={() => router.prefetch(`/customer-orders/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell, cellIndex) => (
                    <TableCell
                      key={cell.id}
                      role="gridcell"
                      className={cn(
                        "border-b border-border/65 px-3 align-middle",
                        columnWidths[cell.column.id],
                        cell.column.id === "poAmount" && "text-right",
                        cellIndex === 0 && "border-l-2",
                        cellIndex === 0 && rowAccent(row.original.status),
                        cell.column.id === "internalOrderNumber" && "sticky left-0 z-10 border-r border-border/70 bg-card group-hover:bg-accent/30 group-focus-visible:bg-accent/40"
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/[0.12] px-4 py-2.5">
        <p className="text-xs text-muted-foreground">
          {isLoading ? "Refreshing records…" : `Showing ${firstResult}–${lastResult} of ${totalCount}`}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Rows
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="h-10 w-[72px] bg-background" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={String(pageSize)}>{pageSize}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="min-w-20 text-center text-xs tabular-nums text-muted-foreground">
            {pagination.pageIndex + 1} / {Math.max(pageCount, 1)}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10"
              disabled={pagination.pageIndex === 0 || isLoading}
              onClick={() => table.previousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10"
              disabled={pagination.pageIndex + 1 >= pageCount || isLoading}
              onClick={() => table.nextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
