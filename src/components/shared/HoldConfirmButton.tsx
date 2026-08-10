// ───────────────── BLOCK 1: Imports ────────────────────────────
'use client'

import * as React from "react"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

// ───────────────── BLOCK 2: Types & Zod Schemas ────────────────
type ButtonVariant = Parameters<typeof buttonVariants>[0]["variant"]
type ButtonSize = Parameters<typeof buttonVariants>[0]["size"]

export interface HoldConfirmButtonProps {
  /** Async Server Action or mutation callback */
  onConfirm: () => Promise<void>
  onError?: (error: unknown) => void
  holdTime?: number
  variant?: ButtonVariant
  /** Sizing prop passed directly to Shadcn. Manage this at the page level. */
  size?: ButtonSize 
  className?: string
  disabled?: boolean

  // --- TEXT API ---
  verb?: string
  subject?: string
  pastTenseVerb?: string
  label?: string
  holdingLabel?: string
  confirmLabel?: string
}
// ───────────────── BLOCK 3: Component / Service ────────────────
const DEFAULT_HOLD_DURATION_MS = 1500
const SUCCESS_RESET_DELAY_MS = 2000
const ERROR_RESET_DELAY_MS = 2000

const RADIUS = 10
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const CHECKMARK_PATH_LENGTH = 24

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false)
  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mql.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [])
  return reduced
}

type ButtonState = "idle" | "holding" | "processing" | "success" | "error"

function HoldConfirmButton({
  onConfirm,
  onError,
  holdTime = DEFAULT_HOLD_DURATION_MS,
  variant = "destructive",
  size, // No default! Fully controlled by the page
  disabled,
  className,
  // Text API
  verb = "Cancel",
  subject,
  pastTenseVerb,
  label,
  holdingLabel,
  confirmLabel,
}: HoldConfirmButtonProps) {
  const prefersReducedMotion = useReducedMotion()
  const [state, setState] = React.useState<ButtonState>("idle")
  const timerRef = React.useRef<NodeJS.Timeout | null>(null)

  const isDisabled = disabled || state === "processing" || state === "success"
  const isActive = state === "holding" || state === "processing"

  // ─── SMART TEXT DERIVATION ───
  const pastVerb = pastTenseVerb || `${verb}ed`
  const idleText = label || (subject ? `Hold to ${verb} ${subject}` : `Hold to ${verb}`)
  const holdingText = holdingLabel || (subject ? `${verb}ing ${subject}...` : `${verb}ing...`)
  const successText = confirmLabel || (subject ? `${subject} ${pastVerb}` : pastVerb)
  const errorText = "Failed"

  const executeAction = async () => {
    setState("processing")
    try {
      await onConfirm()
      setState("success")
      setTimeout(() => setState("idle"), SUCCESS_RESET_DELAY_MS)
    } catch (err) {
      setState("error")
      onError?.(err)
      setTimeout(() => setState("idle"), ERROR_RESET_DELAY_MS)
    }
  }

  const startHold = () => {
    if (isDisabled || isActive) return
    if (prefersReducedMotion) {
      executeAction()
      return
    }
    setState("holding")
    timerRef.current = setTimeout(() => {
      executeAction()
    }, holdTime)
  }

  const cancelHold = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (state === "holding") setState("idle")
  }

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startHold()
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    cancelHold()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault()
      startHold()
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      cancelHold()
    }
  }

  return (
    <button
      type="button"
      disabled={isDisabled}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelHold}
      onPointerLeave={cancelHold}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={state === "success" ? successText : state === "error" ? errorText : isActive ? holdingText : idleText}
      aria-live="polite"
      className={cn(
        buttonVariants({
          variant: state === "error" ? "outline" : variant,
          size,
        }),
        // w-fit prevents grids/flexboxes from stretching the button wide
        "relative w-fit touch-none select-none overflow-hidden",
        "transition-all duration-150 ease-in-out",
        // Tactile "Sinking" Feel
        isActive ? "scale-[0.96] shadow-none" : "scale-100 shadow-sm",
        className
      )}
    >
      {/* ICON / RING / CHECKMARK SLOT */}
      {/* Only render when active/success/error so text stays perfectly centered in idle */}
      {state !== "idle" && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          {state === "error" && <AlertCircle className="h-5 w-5 text-destructive" />}
          {(isActive || state === "success") && (
            <svg
              className="h-5 w-5 -rotate-90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Background Track */}
              <circle
                cx="12"
                cy="12"
                r={RADIUS}
                className="text-muted-foreground/30"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={0}
              />
              {/* Progress Ring (Visual only, synced to holdTime duration) */}
              <circle
                cx="12"
                cy="12"
                r={RADIUS}
                className={cn(
                  state === "success" ? "text-primary" : "text-foreground",
                  "transition-property-[stroke-dashoffset] ease-linear"
                )}
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={isActive ? 0 : CIRCUMFERENCE}
                style={{
                  transitionDuration: isActive ? `${holdTime}ms` : "200ms",
                  transitionTimingFunction: isActive ? "linear" : "ease-out",
                }}
              />
              {/* Checkmark Path (Draws on Success) */}
              <path
                d="M5 12l3 3 7-7"
                className="text-primary transition-property-[stroke-dashoffset] duration-300 ease-in-out"
                strokeDasharray={CHECKMARK_PATH_LENGTH}
                strokeDashoffset={state === "success" ? 0 : CHECKMARK_PATH_LENGTH}
                style={{ transform: "rotate(90deg)", transformOrigin: "center" }}
              />
            </svg>
          )}
        </span>
      )}

      {/* TEXT SLOT */}
      <span className="whitespace-nowrap">
        {state === "success"
          ? successText
          : state === "error"
          ? errorText
          : isActive
          ? holdingText
          : idleText}
      </span>
    </button>
  )
}

// ───────────────── BLOCK 4: Exports ────────────────────────────
export { HoldConfirmButton }