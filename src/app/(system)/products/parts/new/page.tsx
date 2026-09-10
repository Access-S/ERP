// ---------------- BLOCK 1: Imports ----------------
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PartForm } from "@/features/parts/components/part-form"
import { PermissionDenied } from "@/features/auth/components/permission-denied"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasPartPermission } from "@/features/parts/services/part-authorization"

// ---------------- BLOCK 2: Page ----------------
export default async function NewPartPage() {
  const principal = await getCurrentPrincipal()
  if (!principal || !hasPartPermission(principal, "create")) {
    return (
      <PermissionDenied
        description="You need permission to create Parts."
        backHref="/products/parts"
        backLabel="Return to Parts Library"
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/products/parts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Parts Library
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Create Part</h1>
        <p className="text-sm text-muted-foreground">
          Add a reusable component to the Parts Library.
        </p>
      </div>
      <div className="max-w-4xl">
        <PartForm mode="create" />
      </div>
    </div>
  )
}
