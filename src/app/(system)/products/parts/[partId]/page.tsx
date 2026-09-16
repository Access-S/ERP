// ───────────────── BLOCK 1: Imports ──────────────────────────────────────────
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { PartStatusActions } from "@/features/parts/components/part-status-actions"
import { getPartById } from "@/features/parts/services/part-service"
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
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasPartPermission } from "@/features/parts/services/part-authorization"

// ───────────────── BLOCK 2: Helpers ──────────────────────────────────────────
const quantityFormatter = new Intl.NumberFormat("en-AU", {
  maximumFractionDigits: 6,
})

function formatStatus(value: string) {
  return value.charAt(0) + value.slice(1).toLocaleLowerCase()
}

// ───────────────── BLOCK 3: Page ─────────────────────────────────────────────
export default async function PartDetailsPage({
  params,
}: {
  params: Promise<{ partId: string }>
}) {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasPartPermission(principal, "view")) {
    return (
      <PermissionDenied
        description="You need permission to view Part details."
        backHref="/products"
        backLabel="Return to Products & BOM"
      />
    )
  }

  const { partId } = await params
  const part = await getPartById(partId)
  if (!part) notFound()

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/products/parts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Parts Library
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="sr-only">{part.part_code}</h1>
            <Badge variant={part.is_active ? "secondary" : "outline"}>
              {part.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-muted-foreground">{part.description ?? "No Part description"}</p>
        </div>
        <PartStatusActions
          partId={part.id}
          partCode={part.part_code}
          isActive={part.is_active}
          activeBomCount={part.active_bom_count}
          canEdit={hasPartPermission(principal, "edit")}
          canChangeStatus={hasPartPermission(
            principal,
            part.is_active ? "deactivate" : "reactivate"
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Type</CardDescription>
            <CardTitle className="text-lg">{part.part_type ?? "Not set"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Default UOM</CardDescription>
            <CardTitle className="text-lg">{part.default_uom ?? "Not set"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>BOMs</CardDescription>
            <CardTitle className="text-2xl">{part.bom_count}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Usage Lines</CardDescription>
            <CardTitle className="text-2xl">{part.line_count}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Where Used</CardTitle>
          <CardDescription>
            Every BOM line currently using this Part. Multiple lines in one BOM remain visible for data review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {part.where_used.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              This Part is not used in any BOM.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Revision</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Per Shipper</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {part.where_used.map((usage, index) => (
                  <TableRow key={`${usage.bom_id}-${index}`}>
                    <TableCell>
                      <Link
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                        href={`/products/boms/${usage.bom_id}`}
                      >
                        {usage.product_code}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-[360px] truncate" title={usage.product_description ?? undefined}>
                        {usage.product_description ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{usage.revision}</TableCell>
                    <TableCell>
                      <Badge variant={usage.bom_status === "ACTIVE" ? "default" : "secondary"}>
                        {formatStatus(usage.bom_status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {usage.quantity === null ? "—" : quantityFormatter.format(usage.quantity)}
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
