// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
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
import { cn } from '@/lib/utils';
import type { DataTableRowData } from '../types';

// ───────────────── BLOCK 2: Types & Zod Schemas ────────────────
interface DataTableProps<TData extends DataTableRowData> {
  // Rule 10: Receive the table instance instead of raw data/columns.
  // This allows the parent to share state with the Toolbar and Pagination.
  table: TanstackTable<TData>;
  getRowHref?: (data: TData) => string;
}

interface DataTableRowProps<TData extends DataTableRowData> {
  row: Row<TData>;
  href?: string;
}

const interactiveElementSelector = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[data-row-navigation-ignore]',
].join(',');

function eventStartedOnInteractiveElement(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(interactiveElementSelector));
}

// ───────────────── BLOCK 3: Component / Service ────────────────
// Rule 9: React.memo for Lists. Extracting the row prevents re-rendering 
// all rows when parent state updates (e.g., opening a dropdown menu in the toolbar).
function DataTableRowComponent<TData extends DataTableRowData>({
  row,
  href,
}: DataTableRowProps<TData>) {
  const router = useRouter();

  function navigate(event: React.MouseEvent<HTMLTableRowElement>) {
    if (!href || event.button !== 0 || eventStartedOnInteractiveElement(event.target)) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }

    router.push(href);
  }

  function navigateWithKeyboard(event: React.KeyboardEvent<HTMLTableRowElement>) {
    if (
      !href ||
      event.key !== 'Enter' ||
      event.target !== event.currentTarget
    ) {
      return;
    }

    event.preventDefault();
    router.push(href);
  }

  return (
    <TableRow
      role="row"
      tabIndex={href ? 0 : undefined}
      onClick={navigate}
      onKeyDown={navigateWithKeyboard}
      onMouseEnter={() => href && router.prefetch(href)}
      data-row-href={href}
      // FIX: Added conditional highlight when row is selected
      className={cn(
        "hover:bg-muted/50 motion-safe:transition-colors motion-safe:duration-150",
        href &&
          "cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        row.getIsSelected() && "bg-muted"
      )}
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

// Rule 10: High-level wrapper component composing Shadcn's low-level primitives
export function DataTable<TData extends DataTableRowData>({
  table,
  getRowHref,
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
              <DataTableRowComponent
                key={row.id}
                row={row}
                href={getRowHref?.(row.original)}
              />
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
// DataTable is exported inline.
