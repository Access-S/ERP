// ───────────────── BLOCK 1: Imports ────────────────────────────
import * as React from "react"
import { Slot } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// ───────────────── BLOCK 2: Button Variants ────────────────────
const buttonVariants = cva(
  /**
   * BASE ENGINE:
   * - justify-center: Forces text to the middle (Fixes your ghost alignment).
   * - transform-gpu: Forces hardware acceleration (Fixes the icon twitch).
   * - origin-center: Ensures the scale expands from the exact middle.
   */
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap flex-nowrap font-sans rounded-lg text-sm font-medium transition-all duration-200 outline-none select-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.92] transform-gpu origin-center ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:brightness-110",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        success: "bg-success text-success-foreground shadow-sm hover:brightness-105",
        warning: "bg-warning text-warning-foreground shadow-sm hover:brightness-105",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 gap-2",
        xs: "h-7 px-2 text-[10px] uppercase tracking-wider gap-1 font-bold",
        sm: "h-8 px-3 text-xs gap-1.5",
        lg: "h-10 px-6 gap-2 text-base",
        icon: "size-9",
        "icon-sm": "size-7", // ADDED: Fix for dialog/sheet/sidebar errors
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

// ───────────────── BLOCK 3: Component Implementation ──────────
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button"
    
    return (
      <Comp
        data-slot="button"
        // Force hardware acceleration on the container to sync SVG and Text transforms
        className={cn(buttonVariants({ variant, size, className }), "will-change-transform", loading && "opacity-80")}
        ref={ref}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

// ───────────────── BLOCK 4: Exports ────────────────────────────
export { Button, buttonVariants }