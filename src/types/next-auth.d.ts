//src/types/next-auth.d.ts

// ───────────────── BLOCK 1: Imports ────────────────────────────
import { DefaultSession } from "next-auth"

// ───────────────── BLOCK 2: Type Augmentation ──────────────────
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      authVersion: number
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    role: string
    authVersion: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    authVersion: number
    sessionStartedAt: number
  }
}

// ───────────────── BLOCK 3: Exports ────────────────────────────
export {}
