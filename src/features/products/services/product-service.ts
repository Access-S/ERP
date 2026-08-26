// ───────────────── BLOCK 1: Imports ────────────────────────────
import { prisma } from "@/lib/db"
import type { Product } from "../types/product-schema"

// ───────────────── BLOCK 2: Service Functions ─────────────────
/**
 * Fetches all products from the database and maps Prisma types to app types.
 * @returns A list of products.
 */
export async function getProducts(): Promise<Product[]> {
  const products = await prisma.products.findMany({
    orderBy: {
      created_at: "desc",
    },
  })

  // Map Prisma's Decimal/Date types to Zod's number/string types
  return products.map((p) => ({
    id: p.id,
    product_code: p.product_code,
    description: p.description,
    units_per_shipper: p.units_per_shipper,
    daily_run_rate: p.daily_run_rate ? Number(p.daily_run_rate) : null,
    hourly_run_rate: p.hourly_run_rate ? Number(p.hourly_run_rate) : null,
    mins_per_shipper: p.mins_per_shipper ? Number(p.mins_per_shipper) : null,
    price_per_shipper: p.price_per_shipper ? Number(p.price_per_shipper) : null,
    is_active: p.is_active, // CHANGED: Fetch real value from DB
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
  })) as Product[]
}

/**
 * Fetches a list of customers with their active SKU counts, sorted highest to lowest.
 */
export async function getCustomerActiveSkus() {
  const customers = await prisma.customer.findMany({
    where: {
      is_active: true,
      products: {
        some: {
          is_active: true
        }
      }
    },
    select: {
      id: true,
      trading_name: true,
      legal_name: true,
      _count: {
        select: {
          products: {
            where: {
              is_active: true
            }
          }
        }
      }
    },
    orderBy: {
      products: {
        _count: "desc"
      }
    }
  })

  // Map to a clean format for the UI
  return customers.map(c => ({
    id: c.id,
    name: c.trading_name || c.legal_name,
    activeSkus: c._count.products
  }))
}

// ───────────────── BLOCK 3: Exports ────────────────────────────
// (Exported inline above)