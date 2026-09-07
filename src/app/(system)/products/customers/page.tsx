// ───────────────── BLOCK 1: Imports & Component ────────────────
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomersTable } from "@/features/customers/components/customers-table"

// ───────────────── BLOCK 2: Page ───────────────────────────────
export default function CustomersPage() {
  return (
    <div className="flex flex-col gap-6 p-6">

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">
          Browse all customer accounts, their terms, and account details.
        </p>
      </div>

      {/* Customer List */}
      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <CardDescription>
            Paginated customer accounts. Click a column header to sort.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomersTable />
        </CardContent>
      </Card>

    </div>
  )
}
