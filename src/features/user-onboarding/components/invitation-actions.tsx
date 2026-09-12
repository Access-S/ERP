"use client"

import { RefreshCw } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { reissueInvitationAction } from "../actions/user-onboarding-actions"
import { ActivationLinkPanel } from "./activation-link-panel"

export function InvitationActions({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition()
  const [invitation, setInvitation] = useState<{
    activationPath: string
    expiresAt: string
  } | null>(null)

  function reissue() {
    startTransition(async () => {
      try {
        const result = await reissueInvitationAction({ userId })
        if (!result.success) {
          toast.error(result.message)
          return
        }
        if (!result.activationPath || !result.expiresAt) {
          toast.error("The link was created but could not be displayed.")
          return
        }
        setInvitation({ activationPath: result.activationPath, expiresAt: result.expiresAt })
        toast.success("Activation link replaced")
      } catch (error) {
        console.error("Invitation reissue response failed", error)
        toast.error("The server response could not be read. Refresh before trying again.")
      }
    })
  }

  return (
    <div className="space-y-4">
      {invitation && <ActivationLinkPanel {...invitation} />}
      <Button type="button" variant="outline" loading={isPending} onClick={reissue}>
        <RefreshCw />
        {invitation ? "Create another link" : "Replace activation link"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Replacing the link revokes every previous unused link for this account.
      </p>
    </div>
  )
}
