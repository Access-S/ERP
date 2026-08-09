// ─── BLOCK 1: Imports ────────────────────────────
import type { Metadata } from "next"
import { Inter, Geist_Mono, Bebas_Neue } from "next/font/google"
import "./globals.css"

// ─── BLOCK 2: Fonts ──────────────────────────────
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
})

const bebasNeue = Bebas_Neue({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
})

// ─── BLOCK 3: Metadata ───────────────────────────
export const metadata: Metadata = {
  title: "MRP System",
  description: "Manufacturing Resource Planning ERP",
}

// ─── BLOCK 4: Component ──────────────────────────
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${geistMono.variable} ${bebasNeue.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}