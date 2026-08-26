"use client"

// ───────────────── BLOCK 1: Imports ────────────────────────────
import { ScrollArea } from "@/components/ui/separator" // Ensure you have ScrollArea from Shadcn
import { ScrollArea as ShadcnScrollArea } from "@/components/ui/scroll-area" // Adjust import based on your setup

// ───────────────── BLOCK 2: Types ────────────────────────────
interface CustomerSkuListProps {
  customers: {
    id: string
    name: string
    activeSkus: number
  }[]
}

// ───────────────── BLOCK 3: Component ─────────────────────────
export function CustomerSkuList({ customers }: CustomerSkuListProps) {
  if (customers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic px-1">
        No active customer SKUs found.
      </p>
    )
  }

  return (
    <ShadcnScrollArea className="h-[300px] w-full pr-4">
      <div className="flex flex-col gap-3">
        {customers.map((customer) => (
          <div key={customer.id} className="flex items-center justify-between text-sm border-b pb-2">
            <span className="font-medium truncate pr-2">{customer.name}</span>
            <span className="font-bold text-muted-foreground">{customer.activeSkus}</span>
          </div>
        ))}
      </div>
    </ShadcnScrollArea>
  )
}