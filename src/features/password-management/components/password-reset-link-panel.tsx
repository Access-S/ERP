"use client"

import { Check, Copy, ShieldAlert } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const expiryFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

export function PasswordResetLinkPanel({
  resetPath,
  expiresAt,
}: {
  resetPath: string
  expiresAt: string
}) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      const absoluteLink = new URL(resetPath, window.location.origin).toString()
      await navigator.clipboard.writeText(absoluteLink)
      setCopied(true)
      toast.success("Password reset link copied")
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error("Could not copy the link. Select and copy it manually.")
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-warning/30 bg-warning/5 p-4">
      <Alert className="border-warning/30 bg-warning/10">
        <ShieldAlert />
        <AlertTitle>Treat this link like a temporary password</AlertTitle>
        <AlertDescription>
          Share it privately with the intended user. Creating another link immediately
          revokes this one.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password-reset-link">Password reset link</Label>
          <span className="text-xs text-muted-foreground">
            Expires {expiryFormatter.format(new Date(expiresAt))}
          </span>
        </div>
        <div className="flex gap-2">
          <Input
            id="password-reset-link"
            readOnly
            value={resetPath}
            className="h-10 font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button type="button" variant="outline" onClick={copyLink} className="h-10">
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </div>
  )
}
