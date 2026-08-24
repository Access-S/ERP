//src/app/(auth)/login/page.tsx

"use client"

// ───────────────── BLOCK 1: Imports ────────────────────────────
import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

// ───────────────── BLOCK 2: Types & Zod Schemas ────────────────
// Note: In a larger feature, this would live in src/features/auth/types/
const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
})

// ───────────────── BLOCK 3: Component ─────────────────────────
export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setIsLoading(true)

    try {
      const res = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      })

      if (res?.error) {
        toast.error("Login Failed", { description: "Invalid email or password" })
      } else {
        toast.success("Login Successful", { description: "Redirecting to dashboard..." })
        router.push("/")
        router.refresh()
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md motion-safe:transition-all">
      <Card className="shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold">MRP System</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your credentials to sign in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@mrp.com"
                {...register("email")}
                disabled={isLoading}
                className="h-11" // Ensures 44px min touch target (WCAG 2.5.8)
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
                disabled={isLoading}
                className="h-11" // Ensures 44px min touch target (WCAG 2.5.8)
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 motion-safe:animate-in motion-safe:fade-in" 
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center text-xs text-muted-foreground">
          <p>Test User: admin@mrp.com</p>
          <p>Test Pass: password123</p>
        </CardFooter>
      </Card>
    </div>
  )
}

// ───────────────── BLOCK 4: Exports ────────────────────────────
// (Default export handled in Block 3)