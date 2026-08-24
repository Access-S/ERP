// ───────────────── BLOCK 1: Component ─────────────────────────
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/50 p-6">
      {children}
    </div>
  )
}