import { KeyRound, ShieldCheck } from "lucide-react"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChangePasswordForm } from "@/features/password-management/components/change-password-form"
import { getCurrentPrincipal } from "@/features/auth/services/authorization-service"

export const dynamic = "force-dynamic"

export default async function AccountSecurityPage() {
  const principal = await getCurrentPrincipal()
  if (!principal) redirect("/login")

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Account security</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage your own sign-in credentials. Passwords are never visible to administrators.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle>Change password</CardTitle>
          </div>
          <CardDescription>
            Confirm your current password, then choose a new unique passphrase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
