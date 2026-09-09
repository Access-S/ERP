import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Building2, ScrollText } from "lucide-react"
import { getProductById } from "@/features/products/services/product-service"
import { ProductStatusActions } from "@/features/products/components/product-status-actions"
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

const numberFormatter = new Intl.NumberFormat("en-AU", {
  maximumFractionDigits: 6,
})

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
})

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function formatStatus(value: string) {
  return value.charAt(0) + value.slice(1).toLocaleLowerCase()
}

function formatNumber(value: number | null, suffix = "") {
  return value === null ? "Not set" : `${numberFormatter.format(value)}${suffix}`
}

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  const product = await getProductById(productId)
  if (!product) notFound()
  const draftBom = product.bom_revisions.find((bom) => bom.status === "DRAFT")

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/products/catalog">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Product Catalog
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{product.product_code}</h1>
              <Badge variant={product.is_active ? "default" : "outline"}>
                {product.is_active ? "Active" : "Inactive"}
              </Badge>
              {product.active_bom_id ? (
                <Badge variant="secondary">BOM Rev {product.active_bom_revision}</Badge>
              ) : (
                <Badge variant="destructive">Active BOM missing</Badge>
              )}
            </div>
            <p className="mt-1 text-muted-foreground">
              {product.description ?? "No Product description"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ProductStatusActions
            productId={product.id}
            productCode={product.product_code}
            isActive={product.is_active}
            activeBomCount={product.active_bom_count}
            draftBomCount={product.draft_bom_count}
            openPurchaseOrderCount={product.open_purchase_order_count}
          />
          <div className="flex flex-wrap justify-end gap-2">
            {draftBom && (
              <Button asChild>
                <Link href={`/products/boms/${draftBom.id}`}>
                  <ScrollText className="mr-2 h-4 w-4" />
                  Open Draft BOM
                </Link>
              </Button>
            )}
            {product.active_bom_id && (
              <Button variant={draftBom ? "outline" : "default"} asChild>
                <Link href={`/products/boms/${product.active_bom_id}`}>
                  <ScrollText className="mr-2 h-4 w-4" />
                  Open Active BOM
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/products/boms">All BOMs</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Customer</CardDescription>
            <CardTitle className="text-lg">
              {product.customer_name ?? "Not assigned"}
            </CardTitle>
          </CardHeader>
          {product.customer_name && (
            <CardContent className="pt-0">
              <Button variant="link" className="h-auto p-0" asChild>
                <Link
                  href={{
                    pathname: "/products/customers",
                    query: { search: product.customer_name },
                  }}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  {product.customer_code ?? "View customer"}
                </Link>
              </Button>
            </CardContent>
          )}
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Units per Shipper</CardDescription>
            <CardTitle className="text-2xl">
              {product.units_per_shipper ?? "Not set"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active BOM</CardDescription>
            <CardTitle className="text-2xl">
              {product.active_bom_revision ? `Revision ${product.active_bom_revision}` : "Missing"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Components</CardDescription>
            <CardTitle className="text-2xl">{product.component_count}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Product Master</CardTitle>
            <CardDescription>Commercial and identification fields for this Product.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
            <div>
              <p className="text-muted-foreground">Category</p>
              <p className="mt-1 font-medium">{product.category ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Unit of Measure</p>
              <p className="mt-1 font-medium">{product.uom}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Price per Shipper</p>
              <p className="mt-1 font-medium">
                {product.price_per_shipper === null
                  ? "Not set"
                  : currencyFormatter.format(product.price_per_shipper)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Customer Code</p>
              <p className="mt-1 font-medium">{product.customer_code ?? "Not assigned"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="mt-1 font-medium">{dateFormatter.format(new Date(product.created_at))}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Updated</p>
              <p className="mt-1 font-medium">{dateFormatter.format(new Date(product.updated_at))}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Production Data</CardTitle>
            <CardDescription>Planning values used by later scheduling and costing workflows.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
            <div>
              <p className="text-muted-foreground">Daily Run Rate</p>
              <p className="mt-1 font-medium">{formatNumber(product.daily_run_rate)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Hourly Run Rate</p>
              <p className="mt-1 font-medium">{formatNumber(product.hourly_run_rate)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Minutes per Shipper</p>
              <p className="mt-1 font-medium">{formatNumber(product.mins_per_shipper, " min")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Default UOM</p>
              <p className="mt-1 font-medium">{product.uom}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>BOM Revision History</CardTitle>
          <CardDescription>
            Active and archived BOM revisions for this Product. Open a revision to inspect its components.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {product.bom_revisions.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              No BOM revisions exist for this Product.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Revision</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Components</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Effective To</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.bom_revisions.map((bom) => (
                  <TableRow key={bom.id}>
                    <TableCell>
                      <Link
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                        href={`/products/boms/${bom.id}`}
                      >
                        Revision {bom.revision}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={bom.status === "ACTIVE" ? "default" : "secondary"}>
                        {formatStatus(bom.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{bom.component_count}</TableCell>
                    <TableCell>{bom.effective_from ?? "—"}</TableCell>
                    <TableCell>{bom.effective_to ?? "—"}</TableCell>
                    <TableCell>{dateFormatter.format(new Date(bom.updated_at))}</TableCell>
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
