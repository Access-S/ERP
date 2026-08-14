// ───────────────── BLOCK 1: Imports ────────────────────────────
import { z } from 'zod'

// ───────────────── BLOCK 2: Zod Schemas & Inferred Types ───────
export const CalendarSelectionModeSchema = z.enum(['single', 'range', 'multiple'])
export type CalendarSelectionMode = z.infer<typeof CalendarSelectionModeSchema>

export const CalendarPresetValueSchema = z.enum([
  'last7Days',
  'last14Days',
  'last30Days',
  'thisMonth',
])
export type CalendarPresetValue = z.infer<typeof CalendarPresetValueSchema>

export const CalendarDateRangeSchema = z.object({
  from: z.date(),
  to: z.date().optional(),
})
export type CalendarDateRange = z.infer<typeof CalendarDateRangeSchema>

export type CalendarValue = Date | Date[] | CalendarDateRange | undefined