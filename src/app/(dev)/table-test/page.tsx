// ───────────────── BLOCK 1: Imports ──────────────────────────────────────────
import { Suspense } from "react"
import { TestTable } from "./components/test-table"
import { Skeleton } from "@/components/ui/skeleton"

// ───────────────── BLOCK 2: Page ─────────────────────────────────────────────
export default function TableTestPage() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Table Test Environment
        </h1>
        <p className="text-muted-foreground">
          Dedicated space for testing the shared data-table components, pagination, and filters.
        </p>
      </div>
      <Suspense
        fallback={(
          <div className="space-y-2" aria-label="Loading table test">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton className="h-10 w-full" key={index} />
            ))}
          </div>
        )}
      >
        <TestTable />
      </Suspense>
    </div>
  )
}
