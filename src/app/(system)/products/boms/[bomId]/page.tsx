// ───────────────── BLOCK 1: Imports ─────────────────
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ArrowLeft, Boxes, CheckCircle2, Library } from "lucide-react"
import { BomComponentsEditor } from "@/features/boms/components/bom-components-editor"
import { BomRevisionActions } from "@/features/boms/components/bom-revision-actions"
import { getBomById, getBomPartOptions } from "@/features/boms/services/bom-service"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasPermission } from "@/features/auth/services/authorization-policy"
import { hasBomPermission } from "@/features/boms/services/bom-authorization"

// ───────────────── BLOCK 2: Helpers ─────────────────
function formatStatus(value: string) {
  return value.charAt(0) + value.slice(1).toLocaleLowerCase()
}

// ───────────────── BLOCK 3: Page ─────────────────
export default async function BomWorkspacePage({
  params,
}: {
  params: Promise<{ bomId: string }>
}) {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasBomPermission(principal, "view")) {
    return (
      <PermissionDenied
        description="You need permission to view BOM revisions and components."
        backHref="/products"
        backLabel="Return to Products & BOM"
      />
    )
  }

  const { bomId } = await params
  const bom = await getBomById(bomId)
  if (!bom) notFound()
  const canEditDraft = hasBomPermission(principal, "editDraft")
  const canViewParts = hasPermission(principal, "part.view")
  const partOptions = bom.status === "DRAFT" && canEditDraft
    ? await getBomPartOptions()
    : []

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/products/boms">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All BOMs
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="sr-only">{bom.product_code}</h1>
              <Badge variant={bom.status === "ACTIVE" ? "default" : "secondary"}>
                {formatStatus(bom.status)}
              </Badge>
              <Badge variant={bom.health === "ATTENTION" ? "destructive" : "secondary"}>
                {bom.health === "ATTENTION" ? "Needs attention" : "Complete"}
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              {bom.product_description ?? "No Product description"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <BomRevisionActions
            bomId={bom.id}
            status={bom.status}
            health={bom.health}
            healthIssues={bom.health_issues}
            canCreateDraft={hasBomPermission(principal, "createDraft")}
            canActivate={hasBomPermission(principal, "activate")}
          />
          {hasPermission(principal, "product.view") && (
            <Button variant="outline" asChild>
              <Link href={`/products/catalog/${bom.product_id}`}>
                <Boxes className="mr-2 h-4 w-4" />
                Product Details
              </Link>
            </Button>
          )}
          {canViewParts && (
            <Button variant="outline" asChild>
              <Link href="/products/parts">
                <Library className="mr-2 h-4 w-4" />
                Parts Library
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revision</CardDescription>
            <CardTitle className="text-2xl">{bom.revision}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Component Lines</CardDescription>
            <CardTitle className="text-2xl">{bom.component_count}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unique Parts</CardDescription>
            <CardTitle className="text-2xl">{bom.unique_part_count}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Quantity Basis</CardDescription>
            <CardTitle className="text-lg">{bom.quantity_basis.replaceAll("_", " ")}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {bom.health === "ATTENTION" ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>BOM validation needs attention</AlertTitle>
          <AlertDescription>{bom.health_issues.join(" · ")}</AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>BOM is complete</AlertTitle>
          <AlertDescription>
            Every component has a positive quantity, a unit of measure, and an active Part.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
          <CardDescription>
            {bom.status === "DRAFT"
              ? "Draft lines can be added, edited, or removed before activation."
              : "Active and archived revisions are read-only. Create a draft revision to make changes."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BomComponentsEditor
            bomId={bom.id}
            status={bom.status}
            lines={bom.lines}
            partOptions={partOptions}
            canEdit={canEditDraft}
            canViewParts={canViewParts}
          />
        </CardContent>
      </Card>
    </div>
  )
}
