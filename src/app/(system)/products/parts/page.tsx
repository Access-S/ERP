// ───────────────── BLOCK 1: Imports & Component ────────────────
import { getPartFilterOptions, getPartStats } from "@/features/parts/services/part-service"
import { PartsTable } from "@/features/parts/components/parts-table"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardDescription, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

// ───────────────── BLOCK 2: Page ───────────────────────────────
export default async function PartsPage() {
  const [stats, filterOptions] = await Promise.all([
    getPartStats(),
    getPartFilterOptions(),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Parts</h1>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Part
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Parts</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Linked to Products</CardDescription>
            <CardTitle className="text-3xl">{stats.linked}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unlinked Parts</CardDescription>
            <CardTitle className="text-3xl">{stats.unlinked}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Missing Quantity</CardDescription>
            <CardTitle className={cn("text-3xl", stats.missingQuantity > 0 && "text-destructive")}>
              {stats.missingQuantity}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Parts List */}
      <PartsTable partTypeOptions={filterOptions.partTypes} />

    </div>
  )
}
