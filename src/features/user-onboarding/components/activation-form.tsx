"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { activateAccountAction } from "../actions/user-onboarding-actions"
import {
  activateAccountSchema,
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
} from "../types/user-onboarding-schema"

type ActivationValues = z.infer<typeof activateAccountSchema>

export function ActivationForm({ token }: { token: string }) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ActivationValues>({
    resolver: zodResolver(activateAccountSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  })

  async function onSubmit(values: ActivationValues) {
    setServerError(null)
    try {
      const result = await activateAccountAction(values)
      if (!result.success) {
        setServerError(result.message)
        return
      }
      router.replace("/login?activated=1")
      router.refresh()
    } catch (error) {
      console.error("Activation response failed", error)
      setServerError("The server response could not be read. Refresh before trying again.")
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
      <Input type="hidden" {...register("token")} />
      {serverError && (
        <Alert variant="destructive">
          <AlertTitle>Activation unsuccessful</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="new-password">Create password</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            className="h-11 pr-11"
            aria-invalid={Boolean(errors.password)}
            disabled={isSubmitting}
            {...register("password")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 h-auto w-11 rounded-l-none text-muted-foreground hover:bg-transparent hover:text-foreground active:scale-100"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm password</Label>
        <Input
          id="confirm-password"
          type={showPassword ? "text" : "password"}
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
        <p className="mt-1.5">A long, unique passphrase is recommended. Password-manager paste is supported.</p>
      </div>

      <Button type="submit" className="h-11 w-full" loading={isSubmitting}>
        <KeyRound />
        Activate account
      </Button>
    </form>
  )
}
