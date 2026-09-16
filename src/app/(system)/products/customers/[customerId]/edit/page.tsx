// ---------------- BLOCK 1: Imports ----------------
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CustomerForm } from "@/features/customers/components/customer-form"
import { getCustomerById } from "@/features/customers/services/customer-service"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasCustomerPermission } from "@/features/customers/services/customer-authorization"

export const dynamic = "force-dynamic"

// ---------------- BLOCK 2: Page ----------------
export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const principal = await getCurrentPrincipal()
  const canEditIdentity = principal
    ? hasCustomerPermission(principal, "editIdentity")
    : false
  const canEditContacts = principal
    ? hasCustomerPermission(principal, "editContacts")
    : false
  const canEditFinancial = principal
    ? hasCustomerPermission(principal, "editFinancial")
    : false
  if (
    !principal ||
    !hasCustomerPermission(principal, "view") ||
    (!canEditIdentity && !canEditContacts && !canEditFinancial)
  ) {
    return (
      <PermissionDenied
        description="You need permission to edit at least one Customer field group."
        backHref="/products/customers"
        backLabel="Return to Customers"
      />
    )
  }

  const { customerId } = await params
  const customer = await getCustomerById(customerId)
  if (!customer) notFound()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/products/customers/${customer.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {customer.customer_code}
          </Link>
        </Button>
        <h1 className="sr-only">Edit Customer</h1>
      </div>
      <div className="max-w-5xl">
        <CustomerForm
          mode="edit"
          customerId={customer.id}
          canEditIdentity={canEditIdentity}
          canEditContacts={canEditContacts}
          canEditFinancial={canEditFinancial}
          initialValues={{
            customerCode: customer.customer_code,
            legalName: customer.legal_name,
            tradingName: customer.trading_name ?? "",
            customerType: customer.customer_type,
            industry: customer.industry ?? "",
            paymentTerms: customer.payment_terms ?? "",
            creditLimit: String(customer.credit_limit),
            defaultCurrency: customer.default_currency,
            defaultDiscountPercentage: String(customer.default_discount_percentage),
            taxId: customer.tax_id ?? "",
            isTaxExempt: customer.is_tax_exempt,
            primaryContactName: customer.primary_contact_name ?? "",
            primaryContactEmail: customer.primary_contact_email ?? "",
            primaryContactPhone: customer.primary_contact_phone ?? "",
            accountsPayablesEmail: customer.accounts_payables_email ?? "",
            notes: customer.notes ?? "",
          }}
        />
      </div>
    </div>
  )
}
