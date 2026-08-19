//src/components/shared/data-table/data-table-pagination.tsx

// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ───────────────── BLOCK 2: Types & Zod Schemas ────────────────
interface DataTablePaginationProps {
  page: number;
  perPage: number;
  pageCount: number;
  // Rule 10: Pagination delegates the execution of state changes
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

// ───────────────── BLOCK 3: Component / Service ────────────────
export function DataTablePagination({
  page,
  perPage,
  pageCount,
  onPageChange,
  onPerPageChange,
}: DataTablePaginationProps) {
  const canPreviousPage = page > 1;
  const canNextPage = page < pageCount;

  return (
    <div className="flex items-center justify-between px-2 py-4">
      <div className="flex-1 text-sm text-muted-foreground">
        Page {page} of {pageCount}
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium text-foreground">Rows per page</p>
          <Select
            value={String(perPage)}
            onValueChange={(value) => onPerPageChange(Number(value))}
          >
            <SelectTrigger className="h-10 w-[70px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={String(pageSize)}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-10 w-10 p-0 lg:flex"
            onClick={() => onPageChange(1)}
            disabled={!canPreviousPage}
            aria-label="Go to first page"
          >
            <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            className="h-10 w-10 p-0"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={!canPreviousPage}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            className="h-10 w-10 p-0"
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            disabled={!canNextPage}
            aria-label="Go to next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-10 w-10 p-0 lg:flex"
            onClick={() => onPageChange(pageCount)}
            disabled={!canNextPage}
            aria-label="Go to last page"
          >
            <ChevronsRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
