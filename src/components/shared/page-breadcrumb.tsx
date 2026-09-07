// ───────────────── BLOCK 1: Imports ────────────────────────────
import * as React from "react"
import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

// ───────────────── BLOCK 2: Types ──────────────────────────────
export interface BreadcrumbCrumb {
  /** Text shown for this step. */
  label: string
  /** Optional href. The LAST item always renders as the current page, even with an href. */
  href?: string
}

interface PageBreadcrumbProps {
  /** Trail from root to current page, e.g. [{ label: "Home", href: "/" }, { label: "Products & BOM" }] */
  items: BreadcrumbCrumb[]
  className?: string
}

// ───────────────── BLOCK 3: Component ──────────────────────────
/**
 * High-level breadcrumb for page headers (Rule 10: composes the low-level
 * primitives in ui/breadcrumb). Designed to be reused at the top of every
 * (system) page, replacing the static "ERP Module" label.
 *
 * Server Component — no hooks, no client JS.
 */
export function PageBreadcrumb({ items, className }: PageBreadcrumbProps) {
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <React.Fragment key={`${item.label}-${index}`}>
              <BreadcrumbItem>
                {item.href && !isLast ? (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
