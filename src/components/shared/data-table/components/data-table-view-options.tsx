//src/components/shared/data-table/components/data-table-view-options.tsx

// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client';

import React from 'react';
import { Table } from '@tanstack/react-table';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DataTableRowData } from '../types';

// ───────────────── BLOCK 2: Types & Zod Schemas ────────────────
interface DataTableViewOptionsProps<TData extends DataTableRowData> {
  table: Table<TData>;
}

// ───────────────── BLOCK 3: Component / Service ────────────────
export function DataTableViewOptions<TData extends DataTableRowData>({
  table,
}: DataTableViewOptionsProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto hidden h-10 lg:flex"
          // Rule 4: Touch targets MUST be minimum 44×44px. h-10 + default py = 2.75rem
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[150px]">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllColumns()
          .filter(
            (column) =>
              typeof column.accessorFn !== 'undefined' && column.getCanHide()
          )
          .map((column) => {
            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize"
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              >
                {column.id}
              </DropdownMenuCheckboxItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
