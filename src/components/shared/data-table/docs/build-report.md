Data Table Module — Build Report
Last updated: Phase 1 completeBranch: feature/ui-playgroundStack: Next.js App Router · TypeScript · Shadcn UI · Tailwind CSS · Prisma · Neon · nuqs · TanStack React Table

1. Module Structure
src/components/shared/data-table/
├── index.ts # Public API barrel — ONLY entry point for consumers
├── defaults.ts # Default config (page sizes, URL keys, operator maps, nuqs opts)
├── docs/
│ └── build-report.md # THIS FILE
├── components/
│ ├── data-table.tsx # Main table shell (receives table instance, renders rows)
│ ├── data-table-column-header.tsx # Sort dropdown + column visibility toggle
│ ├── data-table-toolbar.tsx # Search input + children slot for filters + view options
│ ├── data-table-pagination.tsx # Page nav, per-page select, "Showing X–Y of Z"
│ ├── data-table-faceted-filter.tsx # Multi-select popover filter (NEEDS REWRITE for server-side)
│ ├── data-table-view-options.tsx # Column visibility dropdown
│ └── data-table-skeleton.tsx # Loading skeleton matching column layout
├── hooks/
│ └── use-data-table.ts # Core hook: URL state, fetching, TanStack instance
├── lib/
│ └── utils.ts # getColumnPinningStyle, getFilterOperators, getValidFilters
└── types/
├── schemas.ts # ALL Zod schemas — single source of truth for types
└── index.ts # Re-exports types + schemas + DataTableRowData convenience type


### Deleted files (consolidated into module)
- `src/components/shared/data-table/types.ts` → replaced by `types/schemas.ts`
- `src/types/data-table.ts` → merged into `types/schemas.ts` + `types/index.ts`
- `src/config/data-table.ts` → replaced by `defaults.ts`
- `src/lib/data-table.ts` → moved to `lib/utils.ts`
- `src/lib/parsers.ts` → dead code, deleted
- `src/components/shared/data-table/use-data-table-state.ts` → dead code, deleted

---

## 2. Architecture Decisions

### 2.1 Server-Side Everything
All filtering, sorting, and pagination happens on the server. The hook calls a `fetchPage` function (Server Action) with a `DataTableRequest` and receives a `DataTableResponseData<T>`. TanStack is configured with `manualPagination: true`, `manualSorting: true`, and ONLY `getCoreRowModel()`. No client-side row models.

### 2.2 URL State Sync via nuqs
Page, perPage, and sort are synced to URL search params. Filters are NOT yet URL-synced (Phase 2 will add this). Multi-sort uses format: `?sort=status.asc,dueDate.desc`. Custom parser built with `createParser` from nuqs v2.

### 2.3 Stable Callbacks via Refs (Rule 9)
`onPaginationChange` and `onSortingChange` use `useStateRef` to read current state without putting changing values in `useCallback` deps. This prevents unnecessary re-renders of all consumers.

### 2.4 Separation of Concerns
- `DataTable` component does NOT fetch data. It receives a `table` instance and renders it.
- Loading/error/skeleton is the PARENT page component's responsibility.
- The hook handles all data flow; components handle all rendering.

### 2.5 Zod Schemas as Single Source of Truth
All data shapes (filters, sorts, request, response, options) are defined as Zod schemas in `types/schemas.ts`. TypeScript types are inferred via `z.infer`. Component props use plain TypeScript interfaces (React's type system handles prop validation at compile time).

### 2.6 WCAG 2.1 AA Grid Pattern — DEFERRED
Full roving tabindex, aria-sort on columnheaders, aria-rowcount, aria-selected on rows are deferred. Basic accessibility kept: aria-hidden on decorative icons, aria-label on buttons/inputs, role="navigation" on pagination.

### 2.7 Touch Targets
All interactive elements use minimum `h-11 w-11` (44px). Shadcn `TableHead` primitive updated to `min-h-11`.

### 2.8 Form Strategy
`react-hook-form` + `@hookform/resolvers` + Shadcn `form.tsx` — decided for ERP field array needs (BOM lines, routing steps). Installed in Phase 0 but not yet used by data-table.

---

## 3. Build Progress

### Phase 0: Prerequisites ✅
- [x] Shadcn: checkbox, form, slider, toggle, toggle-group
- [x] Libraries: exceljs, react-hook-form, @hookform/resolvers

### Phase 1: Foundation ✅
- [x] File reorganization into module folder structure
- [x] Zod schemas (types/schemas.ts, types/index.ts)
- [x] Default configuration (defaults.ts)
- [x] Utility functions (lib/utils.ts) — fixed getDefaultFilterOperator bug
- [x] Hook rewrite (use-data-table.ts) — server-side, multi-sort, stable callbacks
- [x] Column header import fix + Radix import fix
- [x] Pagination update — totalCount, configurable sizes, touch targets
- [x] Skeleton component
- [x] Public API barrel (index.ts)
- [x] TableHead touch target fix in Shadcn primitive

### Phase 2: Filtering System 🔲
- [ ] lib/filters.ts — Filter serialization/deserialization for server
- [ ] components/data-table-filter-menu.tsx — Per-column filter popover (NEW)
- [ ] components/data-table-filter-list.tsx — Active filters display (NEW)
- [ ] components/data-table-date-filter.tsx — Date range filter (NEW)
- [ ] components/data-table-range-filter.tsx — Number range filter (NEW)
- [ ] components/data-table-faceted-filter.tsx — REWRITE for server-side (receive options/counts as props)
- [ ] components/data-table-toolbar.tsx — REWRITE: remove client-side search, wire filter components
- [ ] Filter URL sync in use-data-table.ts
- [ ] Hook: add fetchTrigger or filter dep management

### Phase 3: Sorting Display & View Options 🔲
- [ ] lib/sorting.ts — Sort serialization helpers
- [ ] components/data-table-sort-list.tsx — Active sorts display (NEW)
- [ ] components/data-table-view-options.tsx — Update: use meta.label instead of column.id
- [ ] components/data-table-advanced-toolbar.tsx — Enhanced toolbar layout (NEW)
- [ ] components/data-table-toolbar.tsx — REWRITE: integrate sort list, advanced toolbar

### Phase 4: Export & Remaining Filters 🔲
- [ ] lib/export.ts — CSV and Excel export
- [ ] components/data-table-slider-filter.tsx — Slider-based number filter (NEW)
- [ ] Wire export into toolbar

---

## 4. Zod Schema Reference

All schemas live in `types/schemas.ts`. Key shapes:

DataTableRequest (sent to server)
├── page: number (1-based)
├── pageSize: number
├── sorts: SortItem[]
│ └── { id: string, desc: boolean }
├── filters: FilterItem[]
│ └── { id: string, operator: FilterOperator, value?: unknown }
├── joinOperator: "and" | "or"
└── search?: string

DataTableResponse (from server)
├── data: TData[]
├── pageCount: number
└── totalCount: number

FilterOperator: "iLike" | "notILike" | "equals" | "notEquals" | "isEmpty" | "isNotEmpty" | "contains" | "notContains" | "startsWith" | "endsWith" | "gt" | "gte" | "lt" | "lte" | "isBetween"

FilterVariant: "text" | "number" | "range" | "date" | "dateRange" | "boolean" | "select" | "multiSelect"


---

## 5. Usage Pattern (How Feature Code Consumes This)

```tsx
// src/features/mrp/components/boms-table.tsx
'use client';

import { useDataTable, DataTable, DataTablePagination, DataTableSkeleton } from '@/components/shared/data-table';
import type { DataTableRequest, DataTableResponseData } from '@/components/shared/data-table';
import { columns } from './bom-columns';

// Server Action (defined in features/mrp/actions/)
async function fetchBoms(params: DataTableRequest): Promise<DataTableResponseData<Bom>> {
  'use server';
  return getBomList(params); // calls service
}

export function BomsTable() {
  const {
    table,
    data,
    isLoading,
    isError,
    error,
    pageCount,
    totalCount,
    rowSelection,
  } = useDataTable({
    columns,
    fetchPage: fetchBoms,
  });

  if (isError) return <div>Error loading data</div>;
  if (isLoading) return <DataTableSkeleton columns={columns} />;

  return (
    <div>
      <DataTable table={table} />
      <DataTablePagination
        page={table.getState().pagination.pageIndex + 1}
        perPage={table.getState().pagination.pageSize}
        pageCount={pageCount}
        totalCount={totalCount}
        onPageChange={(p) => table.setPageIndex(p - 1)}
        onPerPageChange={(size) => table.setPageSize(size)}
      />
    </div>
  );
}

6. Column Definition Pattern

// src/features/mrp/components/bom-columns.tsx
import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/shared/data-table';
import type { Bom } from '@/features/mrp/types';

export const columns: ColumnDef<Bom>[] = [
  {
    accessorKey: 'itemCode',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Item Code" />,
    enableSorting: true,
  },
  {
    accessorKey: 'quantity',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Quantity" />,
    enableSorting: true,
  },
  // Phase 2 will add meta for filter variant:
  // meta: { variant: 'text', label: 'Item Code' }
];

7. Known Issues / Deferred
Item
Status
Notes
WCAG 2.1 AA grid pattern	Deferred	Roving tabindex, aria-sort, aria-rowcount, aria-selected
faceted-filter.tsx	Needs rewrite	Currently client-side (getFacetedUniqueValues, setFilterValue). Phase 2.
toolbar.tsx search	Needs rewrite	Currently uses table.setGlobalFilter (client-side). Phase 2.
Filter URL sync	Not implemented	Filters are local state only. Phase 2.
ColumnMeta module augmentation	Not implemented	Will be added in Phase 2 when filter-menu reads meta.variant
Export (CSV/Excel)	Not implemented	Phase 4
Sort list display	Not implemented	Phase 3

8. Pre-existing Errors (Not Data-Table)
These exist in the codebase and are unrelated to this module:

src/app/(system)/playground/page.tsx — 3 type errors (interface extension, badge variant, tabs variant)
src/components/shared/calendar.tsx — children prop error
src/components/ui/dialog.tsx, sheet.tsx, sidebar.tsx — "icon-sm" variant mismatch
src/hooks/use-callback-ref.ts — double export (same pattern we fixed in data-table)
src/hooks/use-debounced-callback.ts — double export

9. Rules Quick Reference
When continuing this build, these rules are absolute:

Feature Isolation — All data-table code in src/components/shared/data-table/. No imports from feature folders.
Data Flow — UI → Server Action → Service → Prisma. Hook calls Server Action, never queries DB directly.
Server by Default — All components are Server Components unless they need hooks/interactivity.
Shadcn Only — No raw HTML, no external UI libs, no hardcoded colors (use design tokens).
Zod First — All data shapes defined as Zod schemas, types inferred.
Soft Deletes — No physical deletes on operational records.
Block Format — All code uses numbered block separators. Updates specify file + block number.
Git Format — git commit -m "type: message". Branch: feature/ui-playground.
Performance — React.memo for list items, useMemo for context, stable callbacks via refs, Set.has() for lookups.
Composition — Low-level composable sub-components, high-level wrappers. No leaked internals.

