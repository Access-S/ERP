// ---------------- BLOCK 1: Imports ----------------
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CustomerForm } from "@/features/customers/components/customer-form"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasCustomerPermission } from "@/features/customers/services/customer-authorization"

// ---------------- BLOCK 2: Page ----------------
export default async function NewCustomerPage() {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasCustomerPermission(principal, "create")) {
    return (
      <PermissionDenied
        description="You need permission to create Customer records."
        backHref="/products/customers"
        backLabel="Return to Customers"
      />
    )
  }

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
        <CustomerForm
          mode="create"
          canEditIdentity
          canEditContacts={hasCustomerPermission(principal, "editContacts")}
          canEditFinancial={hasCustomerPermission(principal, "editFinancial")}
        />
      </div>
    </div>
  )
}
