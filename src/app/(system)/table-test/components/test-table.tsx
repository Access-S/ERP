// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client'

import React, { useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { useDataTable } from '@/components/shared/data-table/hooks/use-data-table'
import { DataTable } from '@/components/shared/data-table/components/data-table'
import { DataTableToolbar } from '@/components/shared/data-table/components/data-table-toolbar'
import { DataTablePagination } from '@/components/shared/data-table/components/data-table-pagination'
import { DataTableColumnHeader } from '@/components/shared/data-table/components/data-table-column-header'
import { DataTableFilterList } from '@/components/shared/data-table/components/data-table-filter-list'
import { DataTableFacetedFilter } from '@/components/shared/data-table/components/data-table-faceted-filter'
import { DatePicker } from '@/components/shared/date-picker'
import { Checkbox } from '@/components/ui/checkbox'
import type { DataTableRowData, DataTableRequest, DataTableResponseData, FilterItem } from '@/components/shared/data-table/types'
import type { CalendarValue } from '@/types/calendar'

// ───────────────── BLOCK 2: Types & Zod Schemas ────────────────
type TestItem = DataTableRowData & {
  id: string
  name: string
  category: string
  quantity: number
  status: 'Active' | 'Inactive'
  createdAt: string
  isApproved: boolean
}

const mockData: TestItem[] = Array.from({ length: 53 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - i)
  return {
    id: `ITEM-${String(i + 1).padStart(3, '0')}`,
    name: `Component ${i + 1}`,
    category: i % 2 === 0 ? 'Raw Material' : 'Finished Good',
    quantity: (i * 13) % 500 + 10,
    status: i % 3 === 0 ? 'Inactive' : 'Active',
    createdAt: date.toISOString(),
    isApproved: i % 4 === 0,
  }
})

async function fetchPage(params: DataTableRequest): Promise<DataTableResponseData<TestItem>> {
  await new Promise((resolve) => setTimeout(resolve, 400))

  let filteredData = [...mockData]

  if (params.search) {
    const searchTerm = params.search.toLowerCase()
    filteredData = filteredData.filter(item =>
      item.id.toLowerCase().includes(searchTerm) ||
      item.name.toLowerCase().includes(searchTerm) ||
      item.category.toLowerCase().includes(searchTerm) ||
      item.status.toLowerCase().includes(searchTerm)
    )
  }

  if (params.filters.length > 0) {
    const joinMethod = params.joinOperator === 'and' ? 'every' : 'some'
    filteredData = filteredData.filter(item =>
      params.filters[joinMethod](filter => {
        const itemValue = item[filter.id as keyof TestItem]
        
        if (filter.operator === 'isEmpty') return !itemValue
        if (filter.operator === 'isNotEmpty') return !!itemValue
        if (filter.value === undefined || filter.value === null) return true
        
        // Handle array values for 'contains' (Multi-Select & Faceted)
        if (filter.operator === 'contains' && Array.isArray(filter.value)) {
          return filter.value.some(val => String(itemValue) === String(val))
        }
        
        if (filter.operator === 'iLike') return String(itemValue).toLowerCase().includes(String(filter.value).toLowerCase())
        
        // Handle Boolean 'equals'
        if (filter.operator === 'equals' && typeof itemValue === 'boolean') {
          return String(itemValue) === String(filter.value)
        }
        
        // Handle Date 'equals' and 'isBetween' (filter.value is a timestamp string)
        if (filter.id === 'createdAt') {
          const itemDate = new Date(itemValue as string).setHours(0, 0, 0, 0)
          if (filter.operator === 'equals') {
            const filterDate = new Date(Number(filter.value)).setHours(0, 0, 0, 0)
            return itemDate === filterDate
          }
          if (filter.operator === 'isBetween' && Array.isArray(filter.value) && filter.value.length === 2) {
            const start = new Date(Number(filter.value[0])).setHours(0, 0, 0, 0)
            const end = new Date(Number(filter.value[1])).setHours(23, 59, 59, 999)
            return itemDate >= start && itemDate <= end
          }
        }
        
        if (filter.operator === 'equals') return String(itemValue) === String(filter.value)
        if (filter.operator === 'gt') return Number(itemValue) > Number(filter.value)
        if (filter.operator === 'lt') return Number(itemValue) < Number(filter.value)
        
        return true
      })
    )
  }

  if (params.sorts.length > 0) {
    const sort = params.sorts[0]
    filteredData.sort((a, b) => {
      const valA = a[sort.id as keyof TestItem]
      const valB = b[sort.id as keyof TestItem]
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sort.desc ? valB - valA : valA - valB
      }
      return sort.desc
        ? String(valB).localeCompare(String(valA))
        : String(valA).localeCompare(String(valB))
    })
  }

  const totalCount = filteredData.length
  const pageCount = Math.ceil(totalCount / params.pageSize)
  const start = (params.page - 1) * params.pageSize
  const end = start + params.pageSize
  const paginatedData = filteredData.slice(start, end)

  return {
    data: paginatedData,
    pageCount,
    totalCount,
  }
}

// ───────────────── BLOCK 3: Component / Service ────────────────
interface TestTableProps {
  initialData: DataTableResponseData<TestItem>
}

function TestTable({ initialData }: TestTableProps) {
  const columns = useMemo<ColumnDef<TestItem>[]>(
    () => [
      {
        accessorKey: 'id',
        header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.getValue('id')}</span>,
        meta: { label: 'ID', variant: 'text' },
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
        cell: ({ row }) => <span className="text-muted-foreground">{row.getValue('name')}</span>,
        meta: { label: 'Name', variant: 'text' },
      },
      {
        accessorKey: 'category',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
        meta: {
          label: 'Category',
          variant: 'multiSelect',
          options: [
            { label: 'Raw Material', value: 'Raw Material' },
            { label: 'Finished Good', value: 'Finished Good' },
          ],
        },
      },
      {
        accessorKey: 'quantity',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Qty" />,
        cell: ({ row }) => <span className="text-foreground tabular-nums">{row.getValue('quantity')}</span>,
        meta: { label: 'Quantity', variant: 'range', range: [10, 500] },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const status = row.getValue('status') as string
          return (
            <span className={status === 'Active' ? 'text-success' : 'text-destructive'}>
              {status}
            </span>
          )
        },
        meta: {
          label: 'Status',
          variant: 'select',
          options: [
            { label: 'Active', value: 'Active' },
            { label: 'Inactive', value: 'Inactive' },
          ],
        },
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Created At" />,
        cell: ({ row }) => <span className="text-muted-foreground">{new Date(row.getValue('createdAt')).toLocaleDateString()}</span>,
        meta: { label: 'Created At', variant: 'date' },
      },
      {
        accessorKey: 'isApproved',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Approved" />,
        cell: ({ row }) => (
          <span className={row.getValue('isApproved') ? 'text-success' : 'text-muted-foreground'}>
            {row.getValue('isApproved') ? 'Yes' : 'No'}
          </span>
        ),
        meta: { label: 'Is Approved', variant: 'boolean' },
      },
      // ADDED: Select column as the very last column
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    []
  )

  const { 
    table, 
    isLoading, 
    pageCount, 
    search, 
    onSearchChange,
    filters,
    joinOperator,
    onFilterChange,
    onFilterRemove,
    onFiltersClear,
    onJoinOperatorChange,
  } = useDataTable<TestItem>({
    columns,
    fetchPage,
    initialData,
  })

  const getFacetedValue = (columnId: string): string[] => {
    const filter = filters.find(f => f.id === columnId)
    if (filter && Array.isArray(filter.value)) return filter.value as string[]
    return []
  }

  const onFacetedChange = (columnId: string, values: string[]) => {
    if (values.length === 0) {
      onFilterRemove(columnId)
    } else {
      onFilterChange({ id: columnId, operator: 'contains', value: values })
    }
  }

  const getDateFilterValue = (columnId: string): CalendarValue => {
    const filter = filters.find(f => f.id === columnId)
    if (!filter || !filter.value) return undefined
    if (Array.isArray(filter.value)) {
      const from = filter.value[0] ? new Date(Number(filter.value[0])) : undefined
      const to = filter.value[1] ? new Date(Number(filter.value[1])) : undefined
      if (from) return { from, to }
    }
    return undefined
  }

  const onDateFilterChange = (columnId: string, value: CalendarValue | undefined) => {
    if (!value) {
      onFilterRemove(columnId)
      return
    }
    if (typeof value === 'object' && 'from' in value) {
      const from = value.from ? value.from.getTime().toString() : ''
      const to = value.to ? value.to.getTime().toString() : ''
      if (from) {
        onFilterChange({ id: columnId, operator: 'isBetween', value: [from, to] })
      }
    }
  }

  return (
    <div className="space-y-4">
      <DataTableToolbar 
        table={table} 
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search items..." 
      >
        <DataTableFacetedFilter
          title="Status"
          options={[
            { label: 'Active', value: 'Active' },
            { label: 'Inactive', value: 'Inactive' },
          ]}
          selectedValues={getFacetedValue('status')}
          onValueChange={(vals) => onFacetedChange('status', vals)}
        />
        <DataTableFilterList
          columns={columns}
          filters={filters}
          joinOperator={joinOperator}
          onFilterChange={onFilterChange}
          onFilterRemove={onFilterRemove}
          onFiltersClear={onFiltersClear}
          onJoinOperatorChange={onJoinOperatorChange}
        />
        <div className="ml-auto w-[250px]">
          <DatePicker
            selectionMode="range"
            value={getDateFilterValue('createdAt')}
            onChange={(val) => onDateFilterChange('createdAt', val)}
            placeholder="Filter Created At"
          />
        </div>
      </DataTableToolbar>
      <DataTable table={table} />
      <DataTablePagination 
        page={table.getState().pagination.pageIndex + 1}
        perPage={table.getState().pagination.pageSize}
        pageCount={pageCount}
        onPageChange={(p) => table.setPageIndex(p - 1)}
        onPerPageChange={(ps) => table.setPageSize(ps)}
      />
      {isLoading && <p className="text-sm text-muted-foreground text-center">Loading...</p>}
    </div>
  )
}

// ───────────────── BLOCK 4: Exports ────────────────────────────
export { TestTable }