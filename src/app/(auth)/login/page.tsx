import type { Metadata } from "next"
import { Boxes, Factory, ShieldCheck, Workflow } from "lucide-react"
import { LoginForm } from "@/features/auth/components/login-form"

export const metadata: Metadata = {
  title: "Sign in | EON MRP",
  description: "Sign in to the EON manufacturing resource planning workspace.",
  robots: { index: false, follow: false },
}

const capabilities = [
  { icon: Boxes, label: "Controlled product and BOM master data" },
  { icon: Workflow, label: "Connected planning and production workflows" },
  { icon: ShieldCheck, label: "Role-aware access for every responsibility" },
]

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    activated?: string
    passwordChanged?: string
    passwordReset?: string
  }>
}) {
  const { activated, passwordChanged, passwordReset } = await searchParams

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1.12fr)_minmax(440px,0.88fr)]">
      <section className="auth-grid relative hidden overflow-hidden bg-olive-950 px-12 py-10 text-olive-50 lg:flex lg:flex-col lg:justify-between xl:px-20 xl:py-14">
        <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-orange-400/30 bg-orange-500/15 shadow-[0_0_35px_rgba(249,115,22,0.16)]">
            <Factory className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <p className="font-heading text-xl font-semibold tracking-[0.18em]">EON</p>
            <p className="text-[10px] uppercase tracking-[0.28em] text-olive-300">Manufacturing ERP</p>
          </div>
        </div>

        <div className="relative max-w-2xl space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-olive-700/70 bg-olive-900/70 px-3 py-1.5 text-xs text-olive-300 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.9)]" />
              One operational source of truth
            </div>
            <h1 className="max-w-xl font-heading text-4xl font-semibold leading-[1.08] tracking-tight xl:text-5xl">
              Run production with clarity from demand to delivery.
            </h1>
            <p className="max-w-xl text-base leading-7 text-olive-300">
              Keep products, BOM revisions, materials, permissions, and execution aligned
              in one controlled manufacturing workspace.
            </p>
          </div>

          <div className="grid gap-3">
            {capabilities.map(({ icon: Icon, label }, index) => (
              <div
                key={label}
                className="group flex items-center gap-4 rounded-xl border border-olive-800 bg-olive-900/55 p-4 backdrop-blur-sm"
              >
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500/10 text-orange-400">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm text-olive-200">{label}</span>
                <span className="ml-auto font-mono text-[10px] text-olive-600">0{index + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between border-t border-olive-800 pt-5 text-[10px] uppercase tracking-[0.22em] text-olive-500">
          <span>Plan · Procure · Produce</span>
          <span>Secure workspace</span>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10 sm:px-10 lg:px-14">
        <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl lg:hidden" />
        <div className="relative w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <p className="font-heading text-lg font-semibold tracking-[0.15em]">EON</p>
              <p className="text-[9px] uppercase tracking-[0.24em] text-muted-foreground">Manufacturing ERP</p>
            </div>
          </div>

          <div className="mb-8 space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Workspace access</p>
            <h2 className="font-heading text-3xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Enter your assigned credentials to continue to the operations workspace.
            </p>
          </div>

          <LoginForm
            activated={activated === "1"}
            passwordChanged={passwordChanged === "1"}
            passwordReset={passwordReset === "1"}
          />

          <div className="mt-9 flex items-center justify-between border-t pt-5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>Authorised personnel only</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Protected</span>
          </div>
        </div>
      </section>
    </main>
  )
}
