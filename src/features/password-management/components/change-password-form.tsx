"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react"
import { signOut } from "next-auth/react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
} from "@/features/user-onboarding/types/user-onboarding-schema"
import { changeOwnPasswordAction } from "../actions/password-actions"
import { changePasswordSchema } from "../types/password-management-schema"

type ChangePasswordValues = z.infer<typeof changePasswordSchema>

export function ChangePasswordForm() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })

  async function onSubmit(values: ChangePasswordValues) {
    setServerError(null)
    try {
      const result = await changeOwnPasswordAction(values)
      if (!result.success) {
        setServerError(result.message)
        return
      }
      await signOut({ callbackUrl: "/login?passwordChanged=1" })
    } catch (error) {
      console.error("Password change response failed", error)
      setServerError("The server response could not be read. Refresh before trying again.")
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {serverError && (
        <Alert variant="destructive">
          <AlertTitle>Password not changed</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="current-password">Current password</Label>
        <div className="relative">
          <Input
            id="current-password"
            type={showCurrentPassword ? "text" : "password"}
            autoComplete="current-password"
            className="h-11 pr-11"
            aria-invalid={Boolean(errors.currentPassword)}
            disabled={isSubmitting}
            {...register("currentPassword")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowCurrentPassword((value) => !value)}
            className="absolute inset-y-0 right-0 h-auto w-11 rounded-l-none text-muted-foreground hover:bg-transparent hover:text-foreground active:scale-100"
            aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
          >
            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {errors.currentPassword && (
          <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={showNewPassword ? "text" : "password"}
            autoComplete="new-password"
            className="h-11 pr-11"
            aria-invalid={Boolean(errors.newPassword)}
            disabled={isSubmitting}
            {...register("newPassword")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowNewPassword((value) => !value)}
            className="absolute inset-y-0 right-0 h-auto w-11 rounded-l-none text-muted-foreground hover:bg-transparent hover:text-foreground active:scale-100"
            aria-label={showNewPassword ? "Hide new password" : "Show new password"}
          >
            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {errors.newPassword && (
          <p className="text-sm text-destructive">{errors.newPassword.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type={showNewPassword ? "text" : "password"}
          autoComplete="new-password"
          className="h-11"
          aria-invalid={Boolean(errors.confirmPassword)}
          disabled={isSubmitting}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">Password requirements</p>
        <p className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          At least {MIN_PASSWORD_LENGTH} characters and no more than {MAX_PASSWORD_BYTES} UTF-8 bytes
        </p>
        <p className="mt-1.5">Changing your password signs out every existing session.</p>
      </div>

      <Button type="submit" className="h-11 w-full" loading={isSubmitting}>
        <KeyRound />
        Change password
      </Button>
    </form>
  )
}
