//src/components/shared/data-table/data-table-toolbar.tsx

// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client';

import React from 'react';
import { Table } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DataTableViewOptions } from './data-table-view-options';
import type { DataTableRowData } from '../types';

// ───────────────── BLOCK 2: Types & Zod Schemas ────────────────
interface DataTableToolbarProps<TData extends DataTableRowData> {
  table: Table<TData>;
  searchKey: string;
  searchPlaceholder?: string;
  // Rule 10: Pass faceted filters as children to keep toolbar generic
  children?: React.ReactNode; 
}

// ───────────────── BLOCK 3: Component / Service ────────────────
export function DataTableToolbar<TData extends DataTableRowData>({
  table,
  searchKey,
  searchPlaceholder = 'Search...',
  children,
}: DataTableToolbarProps<TData>) {
  const [searchValue, setSearchValue] = React.useState(
    (table.getState().globalFilter as string) ?? ''
  );

  // Rule 9: Stable Callbacks. Debounce the search input to prevent excessive URL updates
  React.useEffect(() => {
    const timer = setTimeout(() => {
      table.setGlobalFilter(searchValue);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchValue, table]);

  return (
    <div className="flex items-center justify-between gap-2 py-4">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-[150px] pl-9 lg:w-[300px] focus-visible:ring-1"
            aria-label={searchPlaceholder}
          />
        </div>
        {/* Render faceted filters here */}
        {children}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}

// ───────────────── BLOCK 4: Exports ────────────────────────────
export { DataTableToolbar };