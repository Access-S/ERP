import { KeyRound } from "lucide-react"
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
      <h1 className="sr-only">Account security</h1>

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
