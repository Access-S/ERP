"use client"

import Link from "next/link"
import { Check, Copy, ExternalLink, ShieldAlert } from "lucide-react"
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

export function ActivationLinkPanel({
  activationPath,
  expiresAt,
  userId,
}: {
  activationPath: string
  expiresAt: string
  userId?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      const absoluteLink = new URL(activationPath, window.location.origin).toString()
      await navigator.clipboard.writeText(absoluteLink)
      setCopied(true)
      toast.success("Activation link copied")
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error("Could not copy the link. Select and copy it manually.")
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
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
          <Label htmlFor="activation-link" className="text-sm font-medium">
            Activation link
          </Label>
          <span className="text-xs text-muted-foreground">
            Expires {expiryFormatter.format(new Date(expiresAt))}
          </span>
        </div>
        <div className="flex gap-2">
          <Input
            id="activation-link"
            readOnly
            value={activationPath}
            className="h-10 font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button type="button" variant="outline" onClick={copyLink} className="h-10">
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      {userId && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/settings/access/users/${userId}`}>
            Open user account
            <ExternalLink />
          </Link>
        </Button>
      )}
    </div>
  )
}
