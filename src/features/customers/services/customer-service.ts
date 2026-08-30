// ───────────────── BLOCK 1: Imports ────────────────────────────
import { prisma } from "@/lib/db"
import type { Customer as PrismaCustomer } from "@prisma/client"
import type { Prisma } from "@prisma/client"
import type {
  DataTableRequest,
  DataTableResponseData,
} from "@/components/shared/data-table/types"
import type { Customer } from "../types/customer-schema"

// ───────────────── BLOCK 2: Constants ──────────────────────────
// Whitelist of columns allowed through to Prisma for server-side sorting.
// Prevents arbitrary field names from reaching the query layer.
const SORTABLE_COLUMNS = new Set([
  "customer_code",
  "legal_name",
  "trading_name",
  "status",
  "customer_type",
  "industry",
  "payment_terms",
  "credit_limit",
  "created_at",
  "updated_at",
])

// ───────────────── BLOCK 3: Mapper ─────────────────────────────
/**
 * Maps a Prisma Customer record to the app-level Customer type.
 * Prisma Decimal -> number, Date -> ISO string (JSON-safe for client components).
 */
function mapToCustomer(c: PrismaCustomer): Customer {
  return {
    id: c.id,
    customer_code: c.customer_code,
    legal_name: c.legal_name,
    trading_name: c.trading_name,
    status: c.status,
    customer_type: c.customer_type,
    industry: c.industry,
    payment_terms: c.payment_terms,
    credit_limit: Number(c.credit_limit),
    default_currency: c.default_currency,
    is_active: c.is_active,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
  }
}

// ───────────────── BLOCK 4: Service Functions ──────────────────
/**
 * Fetches one page of customers for the shared DataTable.
 * Supports server-side pagination and sorting (whitelisted columns).
 * Filtering/search support can be added here in a later phase.
 */
export async function getCustomersPage(
  params: DataTableRequest
): Promise<DataTableResponseData<Customer>> {
  const { page, pageSize, sorts } = params

  // Drop any sort request for columns that are not whitelisted.
  const safeSorts = sorts.filter((s) => SORTABLE_COLUMNS.has(s.id))

  const orderBy: Prisma.CustomerOrderByWithRelationInput[] = safeSorts.length
    ? safeSorts.map(
        (s) =>
          ({ [s.id]: s.desc ? "desc" : "asc" }) as Prisma.CustomerOrderByWithRelationInput
      )
    : [{ created_at: "desc" }]

  const [customers, totalCount] = await Promise.all([
    prisma.customer.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
    }),
    prisma.customer.count(),
  ])

  return {
    data: customers.map(mapToCustomer),
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
    totalCount,
  }
}
