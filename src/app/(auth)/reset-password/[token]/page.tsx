import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, Factory, KeyRound, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ResetPasswordForm } from "@/features/password-management/components/reset-password-form"
import { getPasswordResetPreview } from "@/features/password-management/services/password-service"
import { passwordResetTokenSchema } from "@/features/password-management/types/password-management-schema"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Reset password | EON MRP",
  description: "Create a new password for your EON MRP account.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

const expiryFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const parsedToken = passwordResetTokenSchema.safeParse(token)
  const reset = parsedToken.success
    ? await getPasswordResetPreview(parsedToken.data)
    : { valid: false as const }

  return (
    <main className="auth-grid relative flex min-h-screen items-center justify-center overflow-hidden bg-olive-950 px-5 py-10">
      <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-orange-500/15 blur-3xl" />
      <div className="absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative w-full max-w-lg space-y-6">
        <div className="flex items-center justify-center gap-3 text-olive-50">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-orange-400/30 bg-orange-500/15">
            <Factory className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <p className="font-heading text-lg font-semibold tracking-[0.16em]">EON</p>
            <p className="text-[9px] uppercase tracking-[0.25em] text-olive-400">Manufacturing ERP</p>
          </div>
        </div>

        <Card className="border-olive-700/30 bg-background shadow-2xl shadow-black/25">
          {reset.valid ? (
            <>
              <CardHeader className="space-y-3 border-b">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">Reset your password</CardTitle>
                  <CardDescription className="mt-1.5 leading-6">
                    Hello, {reset.name}. Create a new private password for
                    <span className="font-medium text-foreground"> {reset.email}</span>.
                  </CardDescription>
                </div>
                <p className="text-xs text-muted-foreground">
                  This link expires {expiryFormatter.format(reset.expiresAt)}.
                </p>
              </CardHeader>
              <CardContent>
                <ResetPasswordForm token={parsedToken.success ? parsedToken.data : ""} />
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-3 border-b">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-warning/15 text-warning">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">Password reset link unavailable</CardTitle>
                  <CardDescription className="mt-1.5 leading-6">
                    This link is invalid, expired, or has already been used. Ask your system
                    administrator to create a replacement.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/login">Return to sign in</Link>
                </Button>
              </CardContent>
            </>
          )}
        </Card>

        <p className="flex items-center justify-center gap-2 text-xs text-olive-400">
          <ShieldCheck className="h-4 w-4" />
          One-time secure password recovery
        </p>
      </div>
    </main>
  )
}
