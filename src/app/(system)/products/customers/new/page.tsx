// ---------------- BLOCK 1: Imports ----------------
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CustomerForm } from "@/features/customers/components/customer-form"

// ---------------- BLOCK 2: Page ----------------
export default function NewCustomerPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/products/customers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Customers
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Create Customer</h1>
        <p className="text-sm text-muted-foreground">
          Add a Customer account for Products, orders, and commercial defaults.
        </p>
      </div>
      <div className="max-w-5xl">
        <CustomerForm mode="create" />
      </div>
    </div>
  )
}
