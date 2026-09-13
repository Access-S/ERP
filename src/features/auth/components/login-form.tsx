"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginSchema } from "@/features/user-onboarding/types/user-onboarding-schema"

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm({
  activated = false,
  passwordChanged = false,
  passwordReset = false,
}: {
  activated?: boolean
  passwordChanged?: boolean
  passwordReset?: boolean
}) {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginValues) {
    setLoginError(null)
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      })
      if (result?.error) {
        setLoginError("The email or password is incorrect, or this account is unavailable.")
        return
      }
      router.replace("/")
      router.refresh()
    } catch (error) {
      console.error("Sign-in response failed", error)
      setLoginError("Sign-in is temporarily unavailable. Please try again.")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {activated && (
        <Alert className="border-success/30 bg-success/10">
          <AlertTitle>Account activated</AlertTitle>
          <AlertDescription>Your password is ready. Sign in to continue.</AlertDescription>
        </Alert>
      )}
      {(passwordChanged || passwordReset) && (
        <Alert className="border-success/30 bg-success/10">
          <AlertTitle>Password updated</AlertTitle>
          <AlertDescription>
            Sign in with your new password. Previous sessions are no longer valid.
          </AlertDescription>
        </Alert>
      )}
      {loginError && (
        <Alert variant="destructive">
          <AlertTitle>Sign-in unsuccessful</AlertTitle>
          <AlertDescription>{loginError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            className="h-12 pl-10"
            aria-invalid={Boolean(errors.email)}
            disabled={isSubmitting}
            {...register("email")}
          />
        </div>
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            autoComplete="current-password"
            className="h-12 px-10"
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

      <Button type="submit" className="h-12 w-full text-sm" loading={isSubmitting}>
        Sign in to workspace
        <ArrowRight />
      </Button>

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Need access or cannot sign in? Contact your system administrator.
      </p>
    </form>
  )
}
