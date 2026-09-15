"use client"

import * as React from "react"
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"

export interface CustomerOrderLineTableItem {
  id: string
  position: number
  productCode: string
  productDescription: string | null
  orderedQuantity: string
  orderUom: string
  calculatedShippers: string | null
  pricePerShipper: string | null
  customerValue: string
  expectedValue: string | null
  requestedDeliveryDate: string | null
  validationStatus: "VALID" | "PO_CHECK"
  validationIssueText: string
}

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function label(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ")
}

function money(currency: string, value: string | null): string {
  return value === null ? "—" : `${currency} ${value}`
}

export function CustomerOrderLinesTable({
  currency,
  lines,
}: {
  currency: string
  lines: readonly CustomerOrderLineTableItem[]
}) {
  const columns = React.useMemo<ColumnDef<CustomerOrderLineTableItem>[]>(() => [
    {
      accessorKey: "position",
      header: "Line",
      cell: ({ row }) => <span className="tabular-nums">{row.original.position}</span>,
    },
    {
      accessorKey: "productCode",
      header: "Product",
      cell: ({ row }) => (
        <div className="max-w-64">
          <div className="font-medium">{row.original.productCode}</div>
          <div
            className="truncate text-xs text-muted-foreground"
            title={row.original.productDescription ?? undefined}
          >
            {row.original.productDescription ?? "—"}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "orderedQuantity",
      header: "Ordered",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.orderedQuantity} {label(row.original.orderUom)}
        </span>
      ),
    },
    {
      accessorKey: "calculatedShippers",
      header: "Shippers",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.calculatedShippers ?? "—"}</span>
      ),
    },
    {
      accessorKey: "pricePerShipper",
      header: "Price / Shipper",
      cell: ({ row }) => (
        <span className="tabular-nums">{money(currency, row.original.pricePerShipper)}</span>
      ),
    },
    {
      accessorKey: "customerValue",
      header: "Customer Value",
      cell: ({ row }) => (
        <span className="tabular-nums">{money(currency, row.original.customerValue)}</span>
      ),
    },
    {
      accessorKey: "expectedValue",
      header: "Expected Value",
      cell: ({ row }) => (
        <span className="tabular-nums">{money(currency, row.original.expectedValue)}</span>
      ),
    },
    {
      accessorKey: "requestedDeliveryDate",
      header: "Delivery",
      cell: ({ row }) => row.original.requestedDeliveryDate
        ? dateFormatter.format(new Date(row.original.requestedDeliveryDate))
        : <span className="font-medium text-destructive">Missing</span>,
    },
    {
      accessorKey: "validationStatus",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.validationStatus === "VALID" ? "secondary" : "destructive"}
          title={row.original.validationIssueText}
        >
          {label(row.original.validationStatus)}
        </Badge>
      ),
    },
  ], [currency])

  // TanStack Table intentionally returns a mutable table API consumed by the shared renderer.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: [...lines],
    getCoreRowModel: getCoreRowModel(),
  })

  return <DataTable table={table} />
}
