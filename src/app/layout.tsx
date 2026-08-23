//src/app/layout.tsx

// ───────────────── BLOCK 1: Imports ────────────────────────────
import type { Metadata } from "next"
import { Toaster } from "sonner"
import { NuqsAdapter } from "nuqs/adapters/next/app" // ADDED: nuqs adapter
import "./globals.css"

import { Work_Sans, Chakra_Petch, JetBrains_Mono } from "next/font/google"

const fontBody = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
})

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
})

const fontHeading = Chakra_Petch({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

// ───────────────── BLOCK 2: Metadata ───────────────────────────
export const metadata: Metadata = {
  title: "MRP System",
  description: "Manufacturing Resource Planning ERP",
}

// ───────────────── BLOCK 3: Root Layout ──────────────────────
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`dark ${fontBody.variable} ${fontMono.variable} ${fontHeading.variable}`}
    >
      <body className="antialiased">
        <NuqsAdapter> {/* ADDED: Wrap app with NuqsAdapter */}
          {children}
        </NuqsAdapter>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}