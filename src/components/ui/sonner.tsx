// ───────────────── BLOCK 1: Imports ────────────────────────────
"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { 
  CircleCheckIcon, 
  InfoIcon, 
  TriangleAlertIcon, 
  OctagonXIcon, 
  Loader2Icon 
} from "lucide-react"

// ───────────────── BLOCK 3: Component Implementation ──────────
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Prevent Sonner from applying its own 'rich' (bright) colors
      richColors={false} 
      icons={{
        success: <CircleCheckIcon className="size-4 text-[oklch(0.627_0.265_149.214)]" />,
        info: <InfoIcon className="size-4 text-[oklch(0.588_0.158_241.966)]" />,
        warning: <TriangleAlertIcon className="size-4 text-[oklch(0.769_0.188_70.08)]" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin text-primary" />,
      }}
      toastOptions={{
        classNames: {
          /* 
             We use !bg-card and !border-border to ensure every state
             matches the ERP Card background.
          */
          toast:
            "group toast !bg-card !text-foreground !border-border shadow-2xl rounded-xl p-4 flex items-center gap-3",
          title: "text-sm font-semibold tracking-tight",
          description: "text-muted-foreground text-xs font-sans mt-0.5",
          actionButton:
            "bg-primary text-primary-foreground font-medium transition-transform active:scale-95",
          cancelButton:
            "bg-muted text-muted-foreground font-medium transition-transform active:scale-95",
          
          // Specific state overrides to maintain theme consistency
          success: "!bg-card !text-foreground !border-border",
          error: "!bg-card !text-foreground !border-border",
          info: "!bg-card !text-foreground !border-border",
        },
      }}
      {...props}
    />
  )
}

// ───────────────── BLOCK 4: Exports ────────────────────────────
export { Toaster }