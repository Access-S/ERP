// ---------------- BLOCK 1: Imports ----------------
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Mail, Phone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CustomerStatusActions } from "@/features/customers/components/customer-status-actions"
import { getCustomerById } from "@/features/customers/services/customer-service"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasCustomerPermission } from "@/features/customers/services/customer-authorization"
import { hasProductPermission } from "@/features/products/services/product-authorization"

export const dynamic = "force-dynamic"

const numberFormatter = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

// ---------------- BLOCK 2: Page ----------------
export default async function CustomerDetailsPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasCustomerPermission(principal, "view")) {
    return (
      <PermissionDenied
        description="You need permission to view Customer records."
        backHref="/products"
        backLabel="Return to Products & BOM"
      />
    )
  }

  const { customerId } = await params
  const customer = await getCustomerById(customerId)
  if (!customer) notFound()
  const canEdit =
    hasCustomerPermission(principal, "editIdentity") ||
    hasCustomerPermission(principal, "editContacts") ||
    hasCustomerPermission(principal, "editFinancial")
  const canViewProducts = hasProductPermission(principal, "view")

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/products/customers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Customers
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="sr-only">
              {customer.trading_name ?? customer.legal_name}
            </h1>
            <Badge variant={customer.is_active ? "default" : "outline"}>
              {customer.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {customer.customer_code} · {customer.legal_name}
          </p>
        </div>
        <CustomerStatusActions
          customerId={customer.id}
          customerCode={customer.customer_code}
          isActive={customer.is_active}
          activeProductCount={customer.active_product_count}
          openPurchaseOrderCount={customer.open_purchase_order_count}
          canEdit={canEdit}
          canChangeStatus={hasCustomerPermission(
            principal,
            customer.is_active ? "deactivate" : "reactivate"
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Customer Type</CardDescription>
            <CardTitle className="text-lg">{customer.customer_type}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Credit Limit</CardDescription>
            <CardTitle className="text-lg">
              {customer.default_currency} {numberFormatter.format(customer.credit_limit)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Products</CardDescription>
            <CardTitle className="text-2xl">{customer.active_product_count}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Live Purchase Orders</CardDescription>
            <CardTitle className="text-2xl">{customer.open_purchase_order_count}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Commercial Settings</CardTitle>
            <CardDescription>Defaults used for new commercial transactions.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
            <div>
              <p className="text-muted-foreground">Industry</p>
              <p className="mt-1 font-medium">{customer.industry ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment Terms</p>
              <p className="mt-1 font-medium">{customer.payment_terms ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Currency</p>
              <p className="mt-1 font-medium">{customer.default_currency}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Default Discount</p>
              <p className="mt-1 font-medium">{customer.default_discount_percentage}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tax ID / ABN</p>
              <p className="mt-1 font-medium">{customer.tax_id ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tax Status</p>
              <p className="mt-1 font-medium">{customer.is_tax_exempt ? "Exempt" : "Taxable"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="mt-1 font-medium">{dateFormatter.format(new Date(customer.created_at))}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Updated</p>
              <p className="mt-1 font-medium">{dateFormatter.format(new Date(customer.updated_at))}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>Primary operational and accounts contacts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <div>
              <p className="text-muted-foreground">Primary Contact</p>
              <p className="mt-1 font-medium">{customer.primary_contact_name ?? "Not set"}</p>
            </div>
            <div className="flex flex-wrap gap-4">
              {customer.primary_contact_email && (
                <Button variant="link" className="h-auto p-0" asChild>
                  <a href={`mailto:${customer.primary_contact_email}`}>
                    <Mail className="mr-2 h-4 w-4" />
                    {customer.primary_contact_email}
                  </a>
                </Button>
              )}
              {customer.primary_contact_phone && (
                <Button variant="link" className="h-auto p-0" asChild>
                  <a href={`tel:${customer.primary_contact_phone}`}>
                    <Phone className="mr-2 h-4 w-4" />
                    {customer.primary_contact_phone}
                  </a>
                </Button>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Accounts Payable</p>
              {customer.accounts_payables_email ? (
                <Button variant="link" className="mt-1 h-auto p-0" asChild>
                  <a href={`mailto:${customer.accounts_payables_email}`}>
                    <Mail className="mr-2 h-4 w-4" />
                    {customer.accounts_payables_email}
                  </a>
                </Button>
              ) : (
                <p className="mt-1 font-medium">Not set</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Notes</p>
              <p className="mt-1 whitespace-pre-wrap font-medium">{customer.notes ?? "No notes"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assigned Products</CardTitle>
          <CardDescription>
            Products currently associated with this Customer. Active assignments must be resolved before deactivation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customer.products.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              No Products are assigned to this Customer.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      {canViewProducts ? (
                        <Link
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                          href={`/products/catalog/${product.id}`}
                        >
                          {product.product_code}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">
                          {product.product_code}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{product.description ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? "default" : "outline"}>
                        {product.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
