//src/app/(system)/layout.tsx

// ─── BLOCK 1: Imports ────────────────────────────
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/shared/app-sidebar"
import { AppBreadcrumb } from "@/components/shared/app-breadcrumb"
import { Separator } from "@/components/ui/separator"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"
import { hasPermission } from "@/features/auth/services/authorization-policy"

// ─── BLOCK 2: Component ──────────────────────────
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const principal = await getCurrentPrincipal()
  const canViewAccessControl = Boolean(
    principal && hasPermission(principal, "admin.user.view")
  )
  const accessLabel = principal
    ? principal.roleKeys.length === 1
      ? principal.roleKeys[0].replaceAll("_", " ")
      : `${principal.roleKeys.length} roles assigned`
    : undefined

  return (
    <SidebarProvider>
      <AppSidebar
        canViewAccessControl={canViewAccessControl}
        accessLabel={accessLabel}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <AppBreadcrumb />
        </header>
        <main className="flex-1 p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
