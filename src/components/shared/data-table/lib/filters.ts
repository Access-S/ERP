// ───────────────── BLOCK 1: Imports ────────────────────────────
import type { FilterItem, FilterOperator } from '../types';
import { dataTableDefaults } from '../defaults';
import { getValidFilters } from './utils';

// ───────────────── BLOCK 2: Filter Lookup ──────────────────────
/**
 * Find the active filter for a specific column.
 * O(n) — acceptable for typical filter counts (<20).
 */
export function findFilter(
  filters: FilterItem[],
  columnId: string
): FilterItem | undefined {
  return filters.find((f) => f.id === columnId);
}

/**
 * Get all filters for a specific column.
 * Useful if a column ever has multiple filters (rare, but supported).
 */
export function getFiltersForColumn(
  filters: FilterItem[],
  columnId: string
): FilterItem[] {
  return filters.filter((f) => f.id === columnId);
}

// ───────────────── BLOCK 3: Filter Mutation ────────────────────
/**
 * Add or replace a filter for a column.
 * One filter per column — setting a new filter replaces the existing one.
 * Returns a new array (immutable).
 */
export function upsertFilter(
  filters: FilterItem[],
  filter: FilterItem
): FilterItem[] {
  const index = filters.findIndex((f) => f.id === filter.id);
  if (index >= 0) {
    const next = [...filters];
    next[index] = filter;
    return next;
  }
  return [...filters, filter];
}

/**
 * Remove the filter for a specific column.
 * Returns a new array (immutable).
 */
export function removeFilter(
  filters: FilterItem[],
  columnId: string
): FilterItem[] {
  return filters.filter((f) => f.id !== columnId);
}

/**
 * Remove all filters. Returns empty array.
 */
export function clearFilters(): FilterItem[] {
  return [];
}

// ───────────────── BLOCK 4: Filter State Checks ───────────────
/**
 * Check if there are any active (non-empty) filters applied.
 */
export function hasActiveFilters(filters: FilterItem[]): boolean {
  return getValidFilters(filters).length > 0;
}

// ───────────────── BLOCK 5: Display Helpers ────────────────────
/**
 * Get the human-readable label for a filter operator.
 * Looks up from the defaults configuration.
 */
export function getOperatorLabel(operator: FilterOperator): string {
  for (const variantOperators of Object.values(
    dataTableDefaults.operatorsByVariant
  )) {
    const found = variantOperators.find((o) => o.value === operator);
    if (found) return found.label;
  }
  return operator;
}

/**
 * Convert a filter value to a display string.
 */
export function formatFilterValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value);
}