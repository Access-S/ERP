"use client"

// ───────────────── BLOCK 1: Imports ────────────────────────────
import { useCallback } from "react" // ADDED: Import useCallback directly
import { Product } from "../types/product-schema"
import { DataTable } from "@/components/shared/data-table/components/data-table"
import { useDataTable } from "@/components/shared/data-table/hooks/use-data-table"
import { ColumnDef } from "@tanstack/react-table"

// ───────────────── BLOCK 2: Column Definitions ────────────────
export const productColumns: ColumnDef<Product>[] = [
  {
    accessorKey: "product_code",
    header: "Code",
  },
  {
    accessorKey: "description",
    header: "Description",
  },
  {
    accessorKey: "price_per_shipper",
    header: "Price",
    cell: ({ row }) => {
      const amount = parseFloat(row.original.price_per_shipper?.toString() || "0")
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount)
      return <span className="font-medium">{formatted}</span>
    },
  },
]

// ───────────────── BLOCK 3: Component ─────────────────────────
interface ProductsTableProps {
  data: Product[]
}

export function ProductsTable({ data }: ProductsTableProps) {
  // FIX: Used the imported useCallback directly
  const mockFetchPage = useCallback(async () => {
    return {
      data: data,
      pageCount: 1,
    }
  }, [data])

  const { table } = useDataTable<Product>({
    data,
    columns: productColumns,
    fetchPage: mockFetchPage, 
  })

  return (
    <div className="border rounded-md p-4">
      <DataTable table={table} />
    </div>
  )
}