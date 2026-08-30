"use server"

// ───────────────── BLOCK 1: Imports ────────────────────────────
import {
  dataTableRequestSchema,
  type DataTableRequest,
  type DataTableResponseData,
} from "@/components/shared/data-table/types"
import { getCustomersPage } from "../services/customer-service"
import type { Customer } from "../types/customer-schema"

// ───────────────── BLOCK 2: Server Actions ─────────────────────
/**
 * Thin Server Action wrapper (Rule 2: UI → Server Action → Service → Prisma).
 * ONLY validates the incoming table request with Zod, then calls the Service.
 * No Prisma queries or business logic here.
 */
export async function fetchCustomersPage(
  params: DataTableRequest
): Promise<DataTableResponseData<Customer>> {
  const validated = dataTableRequestSchema.parse(params)
  return getCustomersPage(validated)
}
