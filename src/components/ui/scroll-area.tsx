"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import { cn } from "@/lib/utils"

// ───────────────── Types ───────────────────────────────────────
interface ScrollAreaProps
  extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  scrollFade?: boolean
  orientation?: "vertical" | "horizontal" | "both"
}

// ───────────────── ScrollArea ──────────────────────────────────
function ScrollArea({
  className,
  children,
  scrollFade = false,
  orientation = "vertical",
  ...props
}: ScrollAreaProps) {
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const [canScrollUp, setCanScrollUp] = React.useState(false)
  const [canScrollDown, setCanScrollDown] = React.useState(false)
  const [isScrolling, setIsScrolling] = React.useState(false)
  const scrollTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const checkScroll = React.useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    setCanScrollUp(el.scrollTop > 2)
    setCanScrollDown(el.scrollTop < el.scrollHeight - el.clientHeight - 2)
  }, [])

  const handleScroll = React.useCallback(() => {
    checkScroll()
    if (!scrollFade) return
    setIsScrolling(true)
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false)
      scrollTimeoutRef.current = null
    }, 800)
  }, [checkScroll, scrollFade])

  React.useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    checkScroll()
    el.addEventListener("scroll", handleScroll, { passive: true })

    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)

    return () => {
      el.removeEventListener("scroll", handleScroll)
      ro.disconnect()
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
        scrollTimeoutRef.current = null
      }
    }
  }, [checkScroll, handleScroll])

  const thumbFade = scrollFade
    ? isScrolling
      ? "opacity-100"
      : "opacity-0 group-hover:opacity-100"
    : "opacity-100"

  return (
    <ScrollAreaPrimitive.Root
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      {/* ── no-scrollbar hides the native browser scrollbar ── */}
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        className="h-full w-full rounded-[inherit] no-scrollbar"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      {/* Gradient overlays */}
      {scrollFade && (
        <>
          <div
            className={cn(
              "pointer-events-none absolute top-0 left-0 right-0 h-6 z-10 transition-opacity duration-200",
              "bg-gradient-to-b from-background to-transparent",
              canScrollUp ? "opacity-100" : "opacity-0"
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute bottom-0 left-0 right-0 h-6 z-10 transition-opacity duration-200",
              "bg-gradient-to-t from-background to-transparent",
              canScrollDown ? "opacity-100" : "opacity-0"
            )}
          />
        </>
      )}

      {/* Vertical scrollbar */}
      {(orientation === "vertical" || orientation === "both") && (
        <ScrollAreaPrimitive.Scrollbar
          orientation="vertical"
          className="group flex touch-none select-none h-full w-2.5 border-l border-l-transparent p-[1px]"
        >
          <ScrollAreaPrimitive.Thumb
            className={cn(
              "relative flex-1 rounded-full w-full transition-all duration-300",
              "bg-foreground/15 hover:bg-foreground/30",
              thumbFade
            )}
          />
        </ScrollAreaPrimitive.Scrollbar>
      )}

      {/* Horizontal scrollbar */}
      {(orientation === "horizontal" || orientation === "both") && (
        <ScrollAreaPrimitive.Scrollbar
          orientation="horizontal"
          className="group flex touch-none select-none h-2.5 flex-col border-t border-t-transparent p-[1px]"
        >
          <ScrollAreaPrimitive.Thumb
            className={cn(
              "relative flex-1 rounded-full h-full transition-all duration-300",
              "bg-foreground/15 hover:bg-foreground/30",
              thumbFade
            )}
          />
        </ScrollAreaPrimitive.Scrollbar>
      )}

      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

export { ScrollArea }