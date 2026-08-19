//src/components/shared/data-table/types/schemas.ts

// ───────────────── BLOCK 1: Imports ────────────────────────────
import { z } from 'zod';
import type { ComponentType, ComponentProps } from 'react';

// ───────────────── BLOCK 2: Filter Operators ────────────────────
export const filterOperatorSchema = z.enum([
  "iLike",
  "notILike",
  "equals",
  "notEquals",
  "isEmpty",
  "isNotEmpty",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "gt",
  "gte",
  "lt",
  "lte",
  "isBetween",
]);

// ───────────────── BLOCK 3: Filter Variants ────────────────────
export const filterVariantSchema = z.enum([
  "text",
  "number",
  "range",
  "date",
  "dateRange",
  "boolean",
  "select",
  "multiSelect",
]);

// ───────────────── BLOCK 4: Join Operators ─────────────────────
export const joinOperatorSchema = z.enum(["and", "or"]);

// ───────────────── BLOCK 5: Sort Item ──────────────────────────
export const sortItemSchema = z.object({
  id: z.string(),
  desc: z.boolean(),
});

// ───────────────── BLOCK 6: Filter Item ────────────────────────
export const filterItemSchema = z.object({
  id: z.string(),
  operator: filterOperatorSchema,
  value: z.unknown().optional(),
});

// ───────────────── BLOCK 7: Option (faceted filters, selects) ──
export const optionSchema = z.object({
  label: z.string(),
  value: z.string(),
  count: z.number().int().nonnegative().optional(),
  icon: z.custom<ComponentType<ComponentProps<"svg">>>().optional(),
});

// ───────────────── BLOCK 8: Server Request Contract ────────────
export const dataTableRequestSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  sorts: z.array(sortItemSchema),
  filters: z.array(filterItemSchema),
  joinOperator: joinOperatorSchema.default("and"),
  search: z.string().optional(),
});

// ───────────────── BLOCK 9: Server Response Contract ───────────
export const dataTableResponseSchema = z.object({
  data: z.array(z.unknown()),
  pageCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
});

// ───────────────── BLOCK 10: Inferred Types ────────────────────
export type FilterOperator = z.infer<typeof filterOperatorSchema>;
export type FilterVariant = z.infer<typeof filterVariantSchema>;
export type JoinOperator = z.infer<typeof joinOperatorSchema>;
export type SortItem = z.infer<typeof sortItemSchema>;
export type FilterItem = z.infer<typeof filterItemSchema>;
export type Option = z.infer<typeof optionSchema>;
export type DataTableRequest = z.infer<typeof dataTableRequestSchema>;
export type DataTableResponse = z.infer<typeof dataTableResponseSchema>;

/**
 * Generic response — use in feature code:
 * type ItemResponse = DataTableResponseData<Item>;
 */
export type DataTableResponseData<TData> = Omit<DataTableResponse, 'data'> & {
  data: TData[];
};