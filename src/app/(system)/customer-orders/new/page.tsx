import Link from "next/link"
import { ArrowLeft, CalendarRange, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasCustomerOrderPermission } from "@/features/customer-orders/services/customer-order-authorization"

export const dynamic = "force-dynamic"

export default async function NewCustomerOrderPage() {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasCustomerOrderPermission(principal, "create")) {
    return (
      <PermissionDenied
        description="You need permission to create Customer Orders."
        backHref="/customer-orders"
        backLabel="Return to Customer Orders"
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/customer-orders"><ArrowLeft className="mr-2 h-4 w-4" />Customer Orders</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Customer PO</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose whether the Customer sent a defined order or a value authority for future releases.
          </p>
        </div>
      </div>
      <div className="grid max-w-4xl gap-5 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <FileText className="mb-2 h-8 w-8 text-primary" />
            <CardTitle>Standard Customer PO</CardTitle>
            <CardDescription>
              Use when the Customer has ordered defined SKUs, quantities, values, and delivery dates now.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild className="w-full"><Link href="/customer-orders/new/standard">Create Standard PO</Link></Button>
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader>
            <CalendarRange className="mb-2 h-8 w-8 text-primary" />
            <CardTitle>Blanket Customer PO</CardTitle>
            <CardDescription>
              Use when the Customer authorises a total value and will call off separate releases over time.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild className="w-full"><Link href="/customer-orders/new/blanket">Create Blanket PO</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
