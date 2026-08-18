// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client';

import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';

// ───────────────── BLOCK 2: Types & Zod Schemas ────────────────
// Rule 5: Zod First (Applying validation constraints via nuqs parsers)
// We define the shape of our URL search parameters.

export const dataTableStateSchema = {
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(10),
  sort: parseAsString.withDefault(''), // format: "columnId.desc" or "columnId.asc"
};

// ───────────────── BLOCK 3: Component / Service ────────────────
/**
 * Custom hook to manage DataTable URL state using nuqs.
 * Rule 2 & 3: Allows Server Components to read URL state for Prisma queries.
 */
export function useDataTableState() {
  return useQueryStates(dataTableStateSchema);
}

// ───────────────── BLOCK 4: Exports ────────────────────────────
export { useDataTableState };