//src/components/shared/data-table/components/data-table-toolbar.tsx

// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client';

import React from 'react';
import { type Table } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DataTableViewOptions } from './data-table-view-options';
import type { DataTableRowData } from '../types';

// ───────────────── BLOCK 2: Types ──────────────────────────
interface DataTableToolbarProps<TData extends DataTableRowData> {
  table: Table<TData>;
  search?: string;
  searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
  children?: React.ReactNode;
}

// ───────────────── BLOCK 3: Component ──────────────────────────
export function DataTableToolbar<TData extends DataTableRowData>({
  table,
  search,
  searchPlaceholder = 'Search...',
  onSearchChange,
  children,
}: DataTableToolbarProps<TData>) {
  const [searchInput, setSearchInput] = React.useState(search ?? '');

  // Sync local input if the external search state changes (e.g., URL direct load or reset)
  React.useEffect(() => {
    setSearchInput(search ?? '');
  }, [search]);

  // Rule 9: Stable callback. Updates local state immediately for fast UI,
  // and calls onSearchChange. Nuqs will debounce the URL/network update.
  const handleSearchChange = React.useCallback(
    (value: string) => {
      setSearchInput(value);
      onSearchChange(value);
    },
    [onSearchChange]
  );

  return (
    <div className="flex items-center justify-between gap-2 py-4">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 w-[150px] pl-9 lg:w-[300px] focus-visible:ring-1"
            aria-label={searchPlaceholder}
          />
        </div>
        {children}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}