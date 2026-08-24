// ───────────────── BLOCK 1: Imports ────────────────────────────
import { auth } from "@/auth"

// ───────────────── BLOCK 2: Proxy Logic ────────────────────────
export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isLoginPage = req.nextUrl.pathname.startsWith("/login")

  // 1. If not logged in and trying to access a protected page -> redirect to login
  if (!isLoggedIn && !isLoginPage) {
    return Response.redirect(new URL("/login", req.nextUrl))
  }

  // 2. If logged in but trying to access login page -> redirect to dashboard
  if (isLoggedIn && isLoginPage) {
    return Response.redirect(new URL("/", req.nextUrl))
  }
})

// ───────────────── BLOCK 3: Route Matching ────────────────────
export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}