// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client'

import { Collapsible as CollapsiblePrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// ───────────────── BLOCK 2: Components ─────────────────────────
function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

function CollapsibleContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      forceMount
      className={cn(
        'grid min-h-0 transition-all duration-200 ease-out',
        'data-[state=open]:grid-rows-[1fr] data-[state=closed]:grid-rows-[0fr]',
        className
      )}
      {...props}
    >
      <div className="overflow-hidden">
        {children}
      </div>
    </CollapsiblePrimitive.CollapsibleContent>
  )
}

// ───────────────── BLOCK 3: Exports ────────────────────────────
export { Collapsible, CollapsibleTrigger, CollapsibleContent }