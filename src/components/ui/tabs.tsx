// ───────────────── BLOCK 1: Imports ────────────────────────────
"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"
import { motion, useReducedMotion } from "framer-motion" // ADDED: For animations

import { cn } from "@/lib/utils"

// Context to track active state and variant for animations
interface TabsContextValue {
  value: string | undefined
  variant: string | undefined
}
const TabsContext = React.createContext<TabsContextValue | null>(null)

// ───────────────── BLOCK 2: Variants & Root ────────────────────
const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none data-[variant=underline]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
        underline: "gap-1 bg-transparent w-full", // ADDED: underline variant
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Tabs({
  className,
  orientation = "horizontal",
  variant = "default",
  value: controlledValue,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root> &
  VariantProps<typeof tabsListVariants>) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const activeValue = controlledValue ?? uncontrolledValue

  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(newValue)
    }
    onValueChange?.(newValue)
  }

  return (
    <TabsContext.Provider value={{ value: activeValue, variant }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        data-variant={variant}
        className={cn(
          "group/tabs flex gap-2 data-horizontal:flex-col",
          className
        )}
        value={controlledValue}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        {...props}
      />
    </TabsContext.Provider>
  )
}

// ───────────────── BLOCK 3: Triggers ────────────────────────────
function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const ctx = React.useContext(TabsContext)
  const activeVariant = ctx?.variant ?? variant ?? 'default'
  
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={activeVariant}
      className={cn(tabsListVariants({ variant: activeVariant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  value,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const ctx = React.useContext(TabsContext)
  const isActive = ctx?.value === value
  const variant = ctx?.variant ?? 'default'
  const shouldReduceMotion = useReducedMotion()
  
  const transition = shouldReduceMotion 
    ? { duration: 0 } 
    : { type: "spring", stiffness: 400, damping: 35 }

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      data-active={isActive}
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap transition-colors group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "text-foreground/60 data-active:text-foreground",
        // FIX: Removed data-active:bg-background so the sliding blob can show through
        variant === 'default' && "group-data-[variant=default]/tabs-list:data-active:shadow-sm",
        className
      )}
      value={value}
      {...props}
    >
      {/* Sliding Gradient Blob for Default Variant */}
      {isActive && variant === 'default' && (
        <motion.span
          layoutId="active-tab-blob"
          className="absolute inset-0 rounded-md bg-background shadow-sm"
          transition={transition}
          style={{ zIndex: 0 }}
        />
      )}
      
      {/* Sliding Line for Line and Underline Variants */}
      {isActive && (variant === 'line' || variant === 'underline') && (
        <motion.span
          layoutId="active-tab-line"
          className="absolute inset-x-0 bottom-[-5px] h-0.5 bg-foreground"
          transition={transition}
          style={{ zIndex: 0 }}
        />
      )}
      
      <span className="relative z-10 flex items-center gap-1.5">
        {props.children}
      </span>
    </TabsPrimitive.Trigger>
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

// ───────────────── BLOCK 4: Exports ────────────────────────────
export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }