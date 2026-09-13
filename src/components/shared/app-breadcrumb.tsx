"use client"

// ───────────────── BLOCK 1: Imports ────────────────────────────
import { usePathname } from "next/navigation"
import {
  PageBreadcrumb,
  type BreadcrumbCrumb,
} from "@/components/shared/page-breadcrumb"

// ───────────────── BLOCK 2: Route Labels ───────────────────────
// Human-readable labels keyed by FULL route path. Routes not listed here
// fall back to a title-cased version of their URL segment, so new pages get
// a sensible breadcrumb automatically with zero wiring.
// Nested pages (e.g. /products/customers) declare their own label and are
// rendered as a child of their parent path segment.
const ROUTE_LABELS: Record<string, string> = {
  "/products": "Products & BOM",
  "/products/catalog": "Product Catalog",
  "/products/customers": "All Customers",
  "/products/boms": "All BOMs",
  "/products/parts": "Parts Library",
  "/inventory": "Inventory (SOH)",
  "/purchase-orders": "Purchase Orders",
  "/forecasts": "Forecasts",
  "/settings": "Settings",
  "/settings/access": "Access Control",
  "/settings/access/users": "Users",
  "/settings/access/roles": "Roles & Permissions",
  "/settings/access/audit": "Security Audit",
}

function labelForPath(path: string, segment: string): string {
  if (path === "/products/customers/new") return "New Customer"
  if (/^\/products\/customers\/[^/]+\/edit$/.test(path)) return "Edit Customer"
  if (/^\/products\/customers\/[^/]+$/.test(path)) return "Customer Details"
  if (path === "/products/catalog/new") return "New Product"
  if (/^\/products\/catalog\/[^/]+\/edit$/.test(path)) return "Edit Product"
  if (/^\/products\/catalog\/[^/]+$/.test(path)) return "Product Details"
  if (/^\/products\/boms\/[^/]+$/.test(path)) return "BOM Workspace"
  if (path === "/products/parts/new") return "New Part"
  if (/^\/products\/parts\/[^/]+\/edit$/.test(path)) return "Edit Part"
  if (/^\/products\/parts\/[^/]+$/.test(path)) return "Part Details"
  if (path === "/settings/access/users/new") return "Invite User"
  if (/^\/settings\/access\/users\/[^/]+$/.test(path)) return "User Access"
  if (path === "/settings/access/roles/new") return "New Custom Role"
  if (/^\/settings\/access\/roles\/[^/]+\/edit$/.test(path)) return "Edit Custom Role"
  if (/^\/settings\/access\/roles\/[^/]+$/.test(path)) return "Role Details"
  return (
    ROUTE_LABELS[path] ??
    segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  )
}

// ───────────────── BLOCK 3: Trail Builder ──────────────────────
/**
 * Builds the crumb trail from the current pathname.
 * "Home" is always the root; every URL segment after it becomes a crumb.
 * The last crumb is rendered as the current page by <PageBreadcrumb>.
 */
function buildTrail(pathname: string): BreadcrumbCrumb[] {
  if (pathname === "/") return [{ label: "Home" }]

  const trail: BreadcrumbCrumb[] = [{ label: "Home", href: "/" }]

  let accumulated = ""
  for (const segment of pathname.split("/").filter(Boolean)) {
    accumulated += `/${segment}`
    trail.push({ label: labelForPath(accumulated, segment), href: accumulated })
  }

  return trail
}

// ───────────────── BLOCK 4: Component ──────────────────────────
/**
 * Navbar breadcrumb — replaces the static "ERP Module" label in the
 * (system) layout header. Pathname-driven, so every route under (system)
 * gets a correct trail with no per-page wiring:
 *
 *   /                    → Home
 *   /products            → Home › Products & BOM
 *   /products/customers  → Home › Products & BOM › All Customers
 */
export function AppBreadcrumb() {
  const pathname = usePathname()
  return <PageBreadcrumb items={buildTrail(pathname)} />
}
