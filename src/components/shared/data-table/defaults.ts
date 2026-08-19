//src/components/shared/data-table/defaults.ts

// ───────────────── BLOCK 1: Imports ────────────────────────────
import type { FilterOperator, FilterVariant } from './types';

// ───────────────── BLOCK 2: Operator Option Type ───────────────
interface OperatorOption {
  label: string;
  value: FilterOperator;
}

// ───────────────── BLOCK 3: Default Configuration ──────────────
export const dataTableDefaults = {
  pageSize: 10,
  pageSizeOptions: [10, 20, 30, 40, 50] as number[],

  urlKeys: {
    page: 'page',
    perPage: 'perPage',
    sort: 'sort',
  } as const,

  operatorsByVariant: {
    text: [
      { label: 'Contains', value: 'iLike' },
      { label: 'Does not contain', value: 'notILike' },
      { label: 'Equals', value: 'equals' },
      { label: 'Not equals', value: 'notEquals' },
      { label: 'Is empty', value: 'isEmpty' },
      { label: 'Is not empty', value: 'isNotEmpty' },
      { label: 'Starts with', value: 'startsWith' },
      { label: 'Ends with', value: 'endsWith' },
    ] satisfies OperatorOption[],
    number: [
      { label: 'Equals', value: 'equals' },
      { label: 'Not equals', value: 'notEquals' },
      { label: 'Is empty', value: 'isEmpty' },
      { label: 'Is not empty', value: 'isNotEmpty' },
      { label: 'Greater than', value: 'gt' },
      { label: 'Greater than or equal', value: 'gte' },
      { label: 'Less than', value: 'lt' },
      { label: 'Less than or equal', value: 'lte' },
      { label: 'Is between', value: 'isBetween' },
    ] satisfies OperatorOption[],
    range: [
      { label: 'Equals', value: 'equals' },
      { label: 'Not equals', value: 'notEquals' },
      { label: 'Is empty', value: 'isEmpty' },
      { label: 'Is not empty', value: 'isNotEmpty' },
      { label: 'Greater than', value: 'gt' },
      { label: 'Greater than or equal', value: 'gte' },
      { label: 'Less than', value: 'lt' },
      { label: 'Less than or equal', value: 'lte' },
      { label: 'Is between', value: 'isBetween' },
    ] satisfies OperatorOption[],
    date: [
      { label: 'Equals', value: 'equals' },
      { label: 'Not equals', value: 'notEquals' },
      { label: 'Is empty', value: 'isEmpty' },
      { label: 'Is not empty', value: 'isNotEmpty' },
      { label: 'Greater than', value: 'gt' },
      { label: 'Less than', value: 'lt' },
      { label: 'Is between', value: 'isBetween' },
    ] satisfies OperatorOption[],
    dateRange: [
      { label: 'Equals', value: 'equals' },
      { label: 'Not equals', value: 'notEquals' },
      { label: 'Is empty', value: 'isEmpty' },
      { label: 'Is not empty', value: 'isNotEmpty' },
      { label: 'Greater than', value: 'gt' },
      { label: 'Less than', value: 'lt' },
      { label: 'Is between', value: 'isBetween' },
    ] satisfies OperatorOption[],
    boolean: [
      { label: 'Equals', value: 'equals' },
    ] satisfies OperatorOption[],
    select: [
      { label: 'Equals', value: 'equals' },
      { label: 'Not equals', value: 'notEquals' },
      { label: 'Is empty', value: 'isEmpty' },
      { label: 'Is not empty', value: 'isNotEmpty' },
    ] satisfies OperatorOption[],
    multiSelect: [
      { label: 'Contains', value: 'contains' },
      { label: 'Does not contain', value: 'notContains' },
      { label: 'Is empty', value: 'isEmpty' },
      { label: 'Is not empty', value: 'isNotEmpty' },
    ] satisfies OperatorOption[],
  } satisfies Record<FilterVariant, OperatorOption[]>,

  nuqsOptions: {
    history: 'replace' as const,
    scroll: false,
    shallow: true,
    debounceMs: 300,
    clearOnDefault: true,
  },
};