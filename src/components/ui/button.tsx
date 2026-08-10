// ───────────────── BLOCK 1: Imports ────────────────────────────
import * as React from "react"
import { Slot } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// ───────────────── BLOCK 2: Button Variants ────────────────────
const buttonVariants = cva(
  /**
   * BASE STYLES:
   * - tactile scale: active:scale-[0.97]
   * - focus ring: ring-offset-background focus-visible:ring-2
   * - pointer: cursor-pointer
   */
  "inline-flex shrink-0 items-center justify-center rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none select-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.97] ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // High-end primary with subtle shadow
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md hover:brightness-110",
        
        // Outline with "Rectangle Hue" focus
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20",
        
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        
        // Ghost: Zero border, background shift on hover
        ghost: "hover:bg-accent hover:text-accent-foreground",
        
        // Destructive (Alert): High contrast
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 gap-2",
        xs: "h-7 px-2 text-xs gap-1",
        sm: "h-8 px-3 text-xs gap-1.5",
        lg: "h-10 px-6 gap-2 text-base",
        icon: "size-9",
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
}

// ───────────────── BLOCK 3: Component Implementation ──────────
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button"
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

// ───────────────── BLOCK 4: Exports ────────────────────────────
export { Button, buttonVariants }