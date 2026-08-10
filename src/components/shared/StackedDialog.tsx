// ───────────────── BLOCK 1: Imports ────────────────────────────
import { cn } from "@/lib/utils"
import { DialogContent } from "@/components/ui/dialog"

// ───────────────── BLOCK 3: Component ──────────────────────────
interface StackedContentProps extends React.ComponentProps<typeof DialogContent> {
  isNestedOpen?: boolean
  offset?: number
}

export function StackedDialogContent({ 
  isNestedOpen, 
  offset = 60, 
  className, 
  children, 
  ...props 
}: StackedContentProps) {
  return (
    <DialogContent
      className={cn(
        "fixed left-[50%] top-[50%] z-50 -translate-x-1/2 transition-all duration-300 ease-in-out",
        isNestedOpen 
          ? `!-translate-y-[calc(50%+${offset}px)] scale-95 opacity-50 blur-[1px]` 
          : "-translate-y-1/2 scale-100 opacity-100 blur-none",
        className
      )}
      {...props}
    >
      {children}
    </DialogContent>
  )
}