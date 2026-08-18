// ───────────────── BLOCK 1: Imports ────────────────────────────
import { z } from 'zod';
import { ColumnDef, RowData } from '@tanstack/react-table';

// ───────────────── BLOCK 2: Types & Zod Schemas ────────────────
// Rule 5: Zod First. Define the static configuration for the table wrapper.
export const DataTablePropsSchema = z.object({
  pageCount: z.number().optional(),
  defaultPageSize: z.number().default(10),
});

// Rule 5: Infer TypeScript interfaces from Zod schemas.
export type DataTableProps = z.infer<typeof DataTablePropsSchema>;

// Extend TanStack's RowData to ensure our generic types are strictly typed
export type DataTableRowData = RowData;

// ───────────────── BLOCK 3: Component / Service ────────────────
// (No logic in this file, purely type definitions)

// ───────────────── BLOCK 4: Exports ────────────────────────────
export { DataTablePropsSchema, DataTableRowData };
export type { ColumnDef };