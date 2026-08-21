// ───────────────── BLOCK 1: Page Shell ────────────────────────────
import React from 'react'
import { TestTable } from './components/test-table'
import type { DataTableResponseData } from '@/components/shared/data-table/types'

// Mock type and fetcher duplicated here for server-side initial load
// In a real feature, this would be an MRP Service function.
type TestItem = {
  id: string
  name: string
  category: string
  quantity: number
  status: 'Active' | 'Inactive'
}

const mockData: TestItem[] = Array.from({ length: 53 }, (_, i) => ({
  id: `ITEM-${String(i + 1).padStart(3, '0')}`,
  name: `Component ${i + 1}`,
  category: i % 2 === 0 ? 'Raw Material' : 'Finished Good',
  quantity: (i * 13) % 500 + 10,
  status: i % 3 === 0 ? 'Inactive' : 'Active',
}))

async function getInitialData(): Promise<DataTableResponseData<TestItem>> {
  const start = 0
  const end = 10
  return {
    data: mockData.slice(start, end),
    pageCount: Math.ceil(mockData.length / 10),
    totalCount: mockData.length,
  }
}

export default async function TableTestPage() {
  const initialData = await getInitialData()

  return (
    <div className="container mx-auto py-10 px-4 max-w-7xl">
      <div className="space-y-2 mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Table Test Environment
        </h1>
        <p className="text-muted-foreground">
          Dedicated space for testing the shared data-table components, pagination, and filters.
        </p>
      </div>
      
      <TestTable initialData={initialData} />
      
    </div>
  )
}