'use client'

// ───────────────── BLOCK 1: Imports ────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type VariantProps } from 'class-variance-authority'
import { Trash2 } from 'lucide-react'

// ───────────────── BLOCK 2: Types & Interfaces ─────────────────
type ButtonVariant = VariantProps<typeof buttonVariants>['variant']

interface HoldConfirmButtonProps {
  onConfirm: () => void
  duration?: number
  children: React.ReactNode
  className?: string
  disabled?: boolean
  variant?: ButtonVariant
}

interface HoldConfirmIconButtonProps {
  onConfirm: () => void
  duration?: number
  icon?: React.ReactNode
  className?: string
  disabled?: boolean
  size?: number
  variant?: ButtonVariant
}

// ───────────────── BLOCK 3: Shared Hook ────────────────────────
function useHoldProgress(
  duration: number,
  onConfirm: () => void,
  disabled?: boolean
) {
  const [progress, setProgress] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const confirmedRef = useRef(false)

  // Keep mutable values fresh for the RAF loop
  const onConfirmRef = useRef(onConfirm)
  const durationRef = useRef(duration)
  useEffect(() => { onConfirmRef.current = onConfirm }, [onConfirm])
  useEffect(() => { durationRef.current = duration }, [duration])

  const clearRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    clearRaf()
    startTimeRef.current = null
    setProgress(0)
    confirmedRef.current = false
  }, [clearRaf])

  const animate = useCallback(() => {
    if (startTimeRef.current === null) return

    const elapsed = Date.now() - startTimeRef.current
    const newProgress = Math.min(elapsed / durationRef.current, 1)

    setProgress(newProgress)

    if (newProgress >= 1 && !confirmedRef.current) {
      confirmedRef.current = true
      onConfirmRef.current()
      reset()
      return
    }

    rafRef.current = requestAnimationFrame(animate)
  }, [reset])

  const start = useCallback(() => {
    if (disabled) return
    confirmedRef.current = false
    startTimeRef.current = Date.now()
    rafRef.current = requestAnimationFrame(animate)
  }, [disabled, animate])

  const stop = useCallback(() => {
    if (!confirmedRef.current) reset()
  }, [reset])

  // Cancel if disabled mid-hold
  useEffect(() => {
    if (disabled) reset()
  }, [disabled, reset])

  useEffect(() => {
    return () => clearRaf()
  }, [clearRaf])

  return { progress, start, stop }
}

// ───────────────── BLOCK 4: HoldConfirmButton Component ────────
export function HoldConfirmButton({
  onConfirm,
  duration = 1500,
  children,
  className,
  disabled = false,
  variant = 'secondary',
}: HoldConfirmButtonProps) {
  const { progress, start, stop } = useHoldProgress(duration, onConfirm, disabled)

  return (
    <Button
      type="button"
      variant={variant}
      className={cn(
        'relative overflow-hidden select-none touch-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Fill layer */}
      <span
        className="absolute inset-0 bg-primary origin-left"
        style={{ transform: `scaleX(${progress})` }}
      />
      {/* Content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </Button>
  )
}

// ───────────────── BLOCK 5: HoldConfirmIconButton Component ────
export function HoldConfirmIconButton({
  onConfirm,
  duration = 1500,
  icon,
  className,
  disabled = false,
  size = 40,
  variant = 'outline',
}: HoldConfirmIconButtonProps) {
  const { progress, start, stop } = useHoldProgress(duration, onConfirm, disabled)

  const padding = 4
  const strokeWidth = 3.5
  const ringSize = size - padding * 2
  const radius = (ringSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <div
      className={cn('relative inline-block', className)}
      style={{ width: size, height: size }}
    >
      <Button
        type="button"
        variant={variant}
        size="icon"
        className={cn(
          'w-full h-full select-none touch-none',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        disabled={disabled}
        onMouseDown={start}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchEnd={stop}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="relative z-10 flex items-center justify-center">
          {icon || <Trash2 className="h-4 w-4" />}
        </span>
      </Button>

      <svg
        className="absolute pointer-events-none"
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        style={{ top: padding, left: padding }}
      >
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          fill="none"
          className="stroke-border"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          fill="none"
          className="stroke-primary"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
        />
      </svg>
    </div>
  )
}