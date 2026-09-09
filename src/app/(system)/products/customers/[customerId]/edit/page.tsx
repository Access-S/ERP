// ---------------- BLOCK 1: Imports ----------------
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CustomerForm } from "@/features/customers/components/customer-form"
import { getCustomerById } from "@/features/customers/services/customer-service"

export const dynamic = "force-dynamic"

// ---------------- BLOCK 2: Page ----------------
export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
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
        <h1 className="text-2xl font-bold tracking-tight">Edit Customer</h1>
        <p className="text-sm text-muted-foreground">
          Update the master data for {customer.trading_name ?? customer.legal_name}.
        </p>
      </div>
      <div className="max-w-5xl">
        <CustomerForm
          mode="edit"
          customerId={customer.id}
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
