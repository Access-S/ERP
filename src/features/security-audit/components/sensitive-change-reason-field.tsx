"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  SENSITIVE_CHANGE_REASON_MAX_LENGTH,
  SENSITIVE_CHANGE_REASON_MIN_LENGTH,
} from "../types/sensitive-change-reason"

export function SensitiveChangeReasonField({
  id,
  value,
  onChange,
  disabled = false,
  autoFocus = false,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Reason for this change</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={SENSITIVE_CHANGE_REASON_MIN_LENGTH}
        maxLength={SENSITIVE_CHANGE_REASON_MAX_LENGTH}
        required
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder="Briefly explain why this access or security change is required."
        className="min-h-20"
      />
      <p className="text-xs text-muted-foreground">
        At least {SENSITIVE_CHANGE_REASON_MIN_LENGTH} characters. This explanation is
        retained in the security audit history.
      </p>
    </div>
  )
}
