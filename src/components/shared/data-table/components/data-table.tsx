//src/components/shared/data-table/data-table.tsx

// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Row,
  Table as TanstackTable,
  flexRender,
} from '@tanstack/react-table';
import type { DataTableRowData } from '../types';

// ───────────────── BLOCK 2: Types & Zod Schemas ────────────────
interface DataTableProps<TData extends DataTableRowData> {
  // Rule 10: Receive the table instance instead of raw data/columns.
  // This allows the parent to share state with the Toolbar and Pagination.
  table: TanstackTable<TData>;
}

interface DataTableRowProps<TData extends DataTableRowData> {
  row: Row<TData>;
}

// ───────────────── BLOCK 3: Component / Service ────────────────
// Rule 9: React.memo for Lists. Extracting the row prevents re-rendering 
// all rows when parent state updates (e.g., opening a dropdown menu in the toolbar).
function DataTableRowComponent<TData extends DataTableRowData>({
  row,
}: DataTableRowProps<TData>) {
  return (
    <TableRow
      role="row"
      className="hover:bg-muted/50 motion-safe:transition-colors motion-safe:duration-150"
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          role="gridcell"
          // Rule 4: 44px (2.75rem) minimum touch target per WCAG 2.5.8
          className="p-4 text-sm text-foreground min-h-[2.75rem] align-middle"
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

const MemoizedTableRow = React.memo(
  DataTableRowComponent,
  (prev, next) => prev.row.original === next.row.original
) as <TData extends DataTableRowData>(props: DataTableRowProps<TData>) => React.ReactElement;

// Rule 10: High-level wrapper component composing Shadcn's low-level primitives
export function DataTable<TData extends DataTableRowData>({
  table,
}: DataTableProps<TData>) {
  return (
    <div className="rounded-md border border-border">
      {/* Rule 4: Accessibility - ARIA grid roles */}
      <Table role="grid">
        <TableHeader role="rowgroup">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              role="row"
              key={headerGroup.id}
              className="hover:bg-transparent border-border"
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  role="columnheader"
                  key={header.id}
                  className="text-muted-foreground px-4 py-3 text-left font-medium h-11"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody role="rowgroup">
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <MemoizedTableRow key={row.id} row={row} />
            ))
          ) : (
            <TableRow role="row" className="hover:bg-transparent">
              <TableCell
                role="gridcell"
                colSpan={table.getAllColumns().length}
                className="h-24 text-center text-muted-foreground"
              >
                No results found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ───────────────── BLOCK 4: Exports ────────────────────────────
export { DataTable };